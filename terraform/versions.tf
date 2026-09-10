terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.100" }
    archive = { source = "hashicorp/archive", version = "~> 2.4" }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Asignatura = "DSY1107"
      Estudiante = var.estudiante
      Origen     = "terraform"
    }
  }
}
