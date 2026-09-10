# Red y VPC por defecto para despliegue en AWS Academy Learner Lab
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Internet Gateway asociado a la VPC por defecto
data "aws_internet_gateway" "default" {
  filter {
    name   = "attachment.vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Tabla de ruteo pública para el microservicio backend en la VPC por defecto
resource "aws_route_table" "publica" {
  vpc_id = data.aws_vpc.default.id

  tags = {
    Name = "dsy1107-rt-${lower(var.estudiante)}"
  }
}

# Ruta obligatoria de salida a internet (0.0.0.0/0) hacia el Internet Gateway
# Se declara sobre la tabla de ruteo propia para evitar el error RouteAlreadyExists de la VPC por defecto
resource "aws_route" "salida_a_internet" {
  route_table_id         = aws_route_table.publica.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = data.aws_internet_gateway.default.id
}

# Asociación de las subredes a la tabla de ruteo con salida a internet
resource "aws_route_table_association" "publica" {
  for_each       = toset(data.aws_subnets.default.ids)
  subnet_id      = each.value
  route_table_id = aws_route_table.publica.id
}

# Repositorio ECR para alojar las imágenes del microservicio backend
resource "aws_ecr_repository" "backend" {
  name                 = "dsy1107-backend-${lower(var.estudiante)}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Cluster ECS
resource "aws_ecs_cluster" "backend" {
  name = "dsy1107-cluster-${lower(var.estudiante)}"
}

# Grupo de logs en CloudWatch
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/dsy1107-backend-${lower(var.estudiante)}"
  retention_in_days = 7
}

# Security Group con puerto 8080 abierto para peticiones reenviadas desde API Gateway
resource "aws_security_group" "ecs_task" {
  name        = "dsy1107-ecs-task-${lower(var.estudiante)}"
  description = "Permite trafico HTTP al backend en puerto 8080"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Acceso HTTP a Spring Boot desde API Gateway"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Salida total a internet para ECR y llamadas externas"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Definición de Tarea ECS Fargate (linux/amd64 - Java 21)
resource "aws_ecs_task_definition" "backend" {
  family                   = "dsy1107-backend-${lower(var.estudiante)}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  # ARN del rol resuelto dinámicamente según la cuenta activa de AWS Academy
  execution_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"
  task_role_arn      = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

# Servicio ECS Fargate
# ignore_changes = [task_definition] es indispensable para convivir con los pipelines de CI/CD (backend_deploy.yml)
resource "aws_ecs_service" "backend" {
  name            = "dsy1107-backend-${lower(var.estudiante)}"
  cluster         = aws_ecs_cluster.backend.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.ecs_task.id]
    assign_public_ip = true
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [
    aws_route.salida_a_internet
  ]
}
