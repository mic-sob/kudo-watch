output "application_table_name" {
  value = aws_dynamodb_table.application.name
}

output "activity_queue_url" {
  value = aws_sqs_queue.activity.url
}

output "application_secret_arn" {
  value = aws_secretsmanager_secret.application.arn
}

output "kms_key_arn" {
  value = aws_kms_key.application.arn
}

output "api_base_url" {
  description = "Base URL of the public KudoWatch API."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "discord_interactions_url" {
  value = "${aws_apigatewayv2_api.http.api_endpoint}/discord/interactions"
}

output "strava_oauth_callback_url" {
  value = "${aws_apigatewayv2_api.http.api_endpoint}/oauth/strava/callback"
}

output "strava_webhook_url" {
  value = "${aws_apigatewayv2_api.http.api_endpoint}/webhooks/strava"
}
