# Unidad 3 (Kafka) en AWS: EC2 con streaming/docker-compose.yml (Zookeeper + Kafka + Kafka-UI + pedidos-streaming-ms
# desde ECR) y un API Gateway HTTPS con JWT de Cognito (api.tf) para que el frontend de Amplify lo use.
# Estado independiente del terraform/ de la EA1. Desplegar y destruir con:
#   ./terraform-kafka/desplegar.sh          # ECR -> build/push -> apply
#   ./terraform-kafka/desplegar.sh destroy
# Kafka (9092) no se expone: el microservicio le habla por la red Docker (kafka:29092). El listener
# PLAINTEXT_HOST del compose anuncia localhost:9092, asi que un cliente Kafka remoto no funcionaria de todas formas.
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
      Proyecto   = "pedidos360-kafka"
      Origen     = "terraform"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ip_permitida" {
  description = "CIDR que puede llegar a Kafka-UI (p. ej. tu IP/32)"
  type        = string
  validation {
    condition     = can(cidrhost(var.ip_permitida, 0)) && var.ip_permitida != "0.0.0.0/0"
    error_message = "Debe ser un CIDR valido y distinto de 0.0.0.0/0."
  }
}

variable "instance_type" {
  description = "Zookeeper + Kafka + Kafka-UI + 1 JVM necesitan ~3,5 GB"
  type        = string
  default     = "t3.medium"
}

variable "tag_imagen" {
  description = "Tag de la imagen en ECR; cambiarlo recrea la EC2 con la nueva version"
  type        = string
  default     = "v1"
}

variable "cognito_user_pool_id" {
  description = "User Pool de la EA1 (terraform/); desplegar.sh lo resuelve con la AWS CLI"
  type        = string
}

variable "cognito_client_id" {
  description = "Client 'spa-react' del User Pool; es el audience del JWT que manda el frontend"
  type        = string
}

variable "origenes_cors" {
  description = "Origenes del frontend que pueden llamar al API de streaming"
  type        = list(string)
  default     = ["http://localhost:5173"]
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

resource "aws_security_group" "kafka" {
  name_prefix = "pedidos360-kafka-"
  description = "Kafka-UI desde ip_permitida; API de streaming para API Gateway"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "kafka-ui"
    from_port   = 8085
    to_port     = 8085
    protocol    = "tcp"
    cidr_blocks = [var.ip_permitida]
  }

  # API Gateway sale por IPs de AWS no fijas: la API queda abierta, pero FiltroOrigen exige el header
  # secreto que solo agrega API Gateway (api.tf) despues de validar el JWT.
  ingress {
    description = "api (via API Gateway)"
    from_port   = 8092
    to_port     = 8092
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- Imagen: ECR (desplegar.sh la construye y sube antes de crear la EC2) ----------

resource "aws_ecr_repository" "streaming" {
  name                 = "pedidos360/pedidos-streaming-ms"
  force_delete         = true
  image_tag_mutability = "MUTABLE"
}

resource "random_password" "origen" {
  length  = 32
  special = false
}

# ---------- EC2 ----------

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "kafka" {
  ami                         = data.aws_ssm_parameter.al2023.value
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.kafka.id]
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
    compose          = file("${path.module}/../streaming/docker-compose.yml")
    registro         = split("/", aws_ecr_repository.streaming.repository_url)[0]
    imagen_streaming = "${aws_ecr_repository.streaming.repository_url}:${var.tag_imagen}"
    region           = var.aws_region
    origen           = random_password.origen.result
  })

  tags = {
    Name = "pedidos360-kafka"
  }
}

# IP fija: el Learner Lab apaga la EC2 al cerrar sesion y sin EIP volveria con otra IP,
# dejando las integraciones de API Gateway apuntando a la vieja.
resource "aws_eip" "kafka" {
  instance = aws_instance.kafka.id
  domain   = "vpc"
}

# Entradas para api.tf (mismo archivo en terraform-rabbitmq/)
locals {
  nombre_api = "pedidos360-kafka-api"
  ip_backend = aws_eip.kafka.public_ip
  rutas = {
    "POST /streaming/demo"     = "8092/api/streaming/demo"
    "POST /streaming/con-key"  = "8092/api/streaming/con-key"
    "GET /streaming/recibidos" = "8092/api/streaming/recibidos"
    "POST /pipeline/demo"      = "8092/api/pipeline/demo"
    "POST /pipeline/evento"    = "8092/api/pipeline/evento"
    "GET /pipeline/alertas"    = "8092/api/pipeline/alertas"
  }
}

# ---------- Salidas ----------

output "ip_publica" {
  value = aws_eip.kafka.public_ip
}

output "instance_id" {
  value = aws_instance.kafka.id
}

output "kafka_ui" {
  value = "http://${aws_eip.kafka.public_ip}:8085"
}

output "ecr_repositorio" {
  value = aws_ecr_repository.streaming.repository_url
}
