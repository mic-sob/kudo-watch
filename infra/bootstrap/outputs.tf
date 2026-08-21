output "state_bucket_name" {
  description = "Bucket name to pass to terraform init."
  value       = aws_s3_bucket.terraform_state.id
}
