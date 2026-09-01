terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.100" }
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Asignatura = "DSY1107"
      Estudiante = "Matias-Araos"
      Origen     = "terraform"
    }
  }
}