variable "aws_region" {
  description = "AWS region where Terraform state is stored."
  type        = string
  default     = "eu-central-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform state."
  type        = string

  validation {
    condition     = length(var.state_bucket_name) >= 3 && length(var.state_bucket_name) <= 63
    error_message = "The S3 bucket name must contain between 3 and 63 characters."
  }
}
