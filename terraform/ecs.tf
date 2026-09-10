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

# Repositorio ECR para alojar las imagenes del microservicio backend
resource "aws_ecr_repository" "backend" {
  name                 = "dsy1107-backend-${lower(var.estudiante)}"
  image_tag_mutability = "MUTABLE"

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

# Security Group con puerto 8080 abierto para el trafico reenviado desde API Gateway
resource "aws_security_group" "ecs_task" {
  name        = "dsy1107-ecs-task-${lower(var.estudiante)}"
  description = "Permite trafico HTTP al backend en puerto 8080"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Acceso HTTP a Spring Boot"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Salida a internet para descargar dependencias o llamadas externas"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Definicion de Tarea Fargate (linux/amd64 - Java 21)
resource "aws_ecs_task_definition" "backend" {
  family                   = "dsy1107-backend-${lower(var.estudiante)}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = data.aws_iam_role.lab_role.arn
  task_role_arn            = data.aws_iam_role.lab_role.arn

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
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

# Servicio ECS Fargate
# ignore_changes = [task_definition] es FUNDAMENTAL para convivir con los pipelines de CI/CD:
# GitHub Actions (backend_deploy.yml) y publicar-ecs.sh actualizan la revision de la tarea con cada imagen nueva.
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
}
