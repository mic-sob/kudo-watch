variable "aws_region" {
  description = "AWS region where the application is deployed."
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
}

variable "discord_guild_id" {
  description = "ID of the single supported Discord guild."
  type        = string
}
