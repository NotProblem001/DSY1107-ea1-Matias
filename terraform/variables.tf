variable "aws_region" {
  type        = string
  description = "Región de AWS para desplegar la infraestructura"
  default     = "us-east-1"
}

variable "estudiante" {
  type        = string
  description = "Identificador del estudiante para nombrar recursos de forma única"
  default     = "Matias-Araos"
}
