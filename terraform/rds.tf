# Base de datos cloud del backend: PostgreSQL en Amazon RDS (privada, solo accesible desde la tarea ECS)
resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "backend" {
  name       = "dsy1107-db-${lower(var.estudiante)}"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_security_group" "rds" {
  name        = "dsy1107-rds-${lower(var.estudiante)}"
  description = "PostgreSQL solo desde la tarea ECS del backend"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "PostgreSQL desde ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_task.id]
  }
}

resource "aws_db_instance" "backend" {
  identifier             = "dsy1107-pedidos-${lower(var.estudiante)}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  storage_type           = "gp3"
  storage_encrypted      = true
  db_name                = "pedidos360"
  username               = "pedidos"
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.backend.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false
  # Entorno academico: se destruye al terminar cada sesion del lab
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 0
  apply_immediately       = true
}
