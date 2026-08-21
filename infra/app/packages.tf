locals {
  lambda_entrypoints = toset([
    "discord-interactions",
    "strava-oauth-start",
    "strava-oauth-callback",
    "strava-webhook",
    "activity-worker",
  ])
}

data "archive_file" "lambda" {
  for_each = local.lambda_entrypoints

  type        = "zip"
  source_file = "${path.module}/../../dist/${each.value}.js"
  output_path = "${path.module}/build/${each.value}.zip"
}
