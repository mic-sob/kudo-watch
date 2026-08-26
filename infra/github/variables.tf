variable "aws_region" {
  description = "AWS region where KudoWatch is deployed."
  type        = string
  default     = "eu-central-1"
}

variable "aws_account_id" {
  description = "AWS account where KudoWatch is deployed."
  type        = string
  default     = "628270103507"
}

variable "github_environment" {
  description = "GitHub Environment allowed to assume the deployment role."
  type        = string
  default     = "production"
}

variable "github_owner" {
  description = "Owner of the GitHub repository."
  type        = string
  default     = "mic-sob"
}

variable "github_repository" {
  description = "Name of the GitHub repository."
  type        = string
  default     = "kudo-watch"
}

variable "state_bucket_name" {
  description = "S3 bucket containing the Terraform state."
  type        = string
  default     = "kudowatch-terraform-state-628270103507"
}
