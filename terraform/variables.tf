variable "aws_region" {
  type        = string
  description = "Región de despliegue en AWS"
  default     = "us-east-1"
}

variable "estudiante" {
  type        = string
  description = "Identificador del estudiante para nombrar recursos"
  default     = "Matias-Araos"
}

variable "lab_role_name" {
  type        = string
  description = "Nombre del rol IAM preexistente en AWS Academy Learner Lab"
  default     = "LabRole"
}
