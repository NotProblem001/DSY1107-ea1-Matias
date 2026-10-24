# EP4: docker compose del cluster RabbitMQ (3 nodos) + microservicios de mensajeria en una EC2.
# Estado independiente del terraform/ de la EA1.
#   terraform init && terraform apply -var="ip_permitida=$(curl -s https://checkip.amazonaws.com)/32"
#   ... verificar ...  terraform destroy
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.100"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Asignatura = "DSY1107"
      Proyecto   = "pedidos360-rabbitmq"
      Origen     = "terraform"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ip_permitida" {
  description = "CIDR que puede llegar a los paneles y APIs (p. ej. tu IP/32)"
  type        = string
  validation {
    condition     = can(cidrhost(var.ip_permitida, 0)) && var.ip_permitida != "0.0.0.0/0"
    error_message = "Debe ser un CIDR valido y distinto de 0.0.0.0/0."
  }
}

variable "instance_type" {
  description = "3 nodos RabbitMQ + 2 JVM necesitan ~4 GB"
  type        = string
  default     = "t3.medium"
}

variable "tag_imagen" {
  description = "Tag de las imagenes en ECR; cambiarlo recrea la EC2 con la nueva version"
  type        = string
  default     = "v1"
}

variable "instance_profile" {
  description = "AWS Academy no permite crear roles IAM: se usa el perfil existente del Learner Lab"
  type        = string
  default     = "LabInstanceProfile"
}

# ---------- Red: VPC por defecto + SG propio ----------

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

resource "aws_security_group" "rabbitmq" {
  name_prefix = "pedidos360-rabbitmq-"
  description = "Paneles RabbitMQ y APIs de mensajeria, solo desde ip_permitida"
  vpc_id      = data.aws_vpc.default.id

  dynamic "ingress" {
    for_each = { panel-1 = 15672, panel-2 = 15673, panel-3 = 15674, amqp = 5672, eventos = 8091, admin = 8097 }
    content {
      description = ingress.key
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = [var.ip_permitida]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- Imagenes: ECR (desplegar.sh las construye y sube antes de crear la EC2) ----------
# Sin S3: el SCP de AWS Academy niega s3:GetBucketObjectLockConfiguration, que el provider lee siempre.

resource "aws_ecr_repository" "ms" {
  for_each             = toset(["pedidos-mensajeria-ms", "rabbit-admin-ms"])
  name                 = "pedidos360/${each.key}"
  force_delete         = true
  image_tag_mutability = "MUTABLE"
}

resource "random_password" "rabbitmq" {
  length  = 20
  special = false
}

resource "random_password" "cookie" {
  length  = 32
  special = false
}

# ---------- EC2 ----------

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "rabbitmq" {
  ami                         = data.aws_ssm_parameter.al2023.value
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.rabbitmq.id]
  iam_instance_profile        = var.instance_profile
  associate_public_ip_address = true
  user_data_replace_on_change = true

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    compose       = file("${path.module}/../messaging/docker-compose.yml")
    rabbitmq_conf = file("${path.module}/../messaging/rabbitmq/rabbitmq.conf")
    registro      = split("/", aws_ecr_repository.ms["rabbit-admin-ms"].repository_url)[0]
    imagen_evento = "${aws_ecr_repository.ms["pedidos-mensajeria-ms"].repository_url}:${var.tag_imagen}"
    imagen_admin  = "${aws_ecr_repository.ms["rabbit-admin-ms"].repository_url}:${var.tag_imagen}"
    region        = var.aws_region
    rabbitmq_pass = random_password.rabbitmq.result
    erlang_cookie = random_password.cookie.result
  })

  tags = {
    Name = "pedidos360-rabbitmq-cluster"
  }
}

# ---------- Salidas ----------

output "ip_publica" {
  value = aws_instance.rabbitmq.public_ip
}

output "instance_id" {
  value = aws_instance.rabbitmq.id
}

output "panel_rabbitmq" {
  value = "http://${aws_instance.rabbitmq.public_ip}:15672 (usuario admin)"
}

output "ecr_repositorios" {
  value = { for k, r in aws_ecr_repository.ms : k => r.repository_url }
}

output "rabbitmq_password" {
  value     = random_password.rabbitmq.result
  sensitive = true
}
