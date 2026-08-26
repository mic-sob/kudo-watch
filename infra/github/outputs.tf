output "github_actions_role_arn" {
  description = "ARN to save as the AWS_ROLE_ARN GitHub Environment variable."
  value       = aws_iam_role.github.arn
}
