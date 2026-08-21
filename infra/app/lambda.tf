locals {
  http_lambdas = {
    discord-interactions = {
      timeout = 5
    }
    strava-oauth-start = {
      timeout = 10
    }
    strava-oauth-callback = {
      timeout = 20
    }
    strava-webhook = {
      timeout = 5
    }
  }

  common_lambda_environment = {
    ACCOUNT_LINKS_TABLE_NAME = aws_dynamodb_table.application.name
    ACTIVITY_QUEUE_URL       = aws_sqs_queue.activity.url
    DISCORD_GUILD_ID         = var.discord_guild_id
    KMS_KEY_ARN              = aws_kms_key.application.arn
    PUBLIC_BASE_URL          = aws_apigatewayv2_api.http.api_endpoint
    SECRETS_ARN              = aws_secretsmanager_secret.application.arn
  }
}

resource "aws_lambda_function" "http" {
  for_each = local.http_lambdas

  function_name = "${local.name}-${each.key}"
  description   = "KudoWatch: ${each.key}"
  role          = aws_iam_role.lambda[each.key].arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "${each.key}.handler"
  timeout       = each.value.timeout
  memory_size   = 256

  filename         = data.archive_file.lambda[each.key].output_path
  source_code_hash = data.archive_file.lambda[each.key].output_base64sha256

  environment {
    variables = local.common_lambda_environment
  }

  depends_on = [
    aws_cloudwatch_log_group.http,
    aws_iam_role_policy.lambda_logs,
  ]
}

resource "aws_lambda_function" "activity_worker" {
  function_name = "${local.name}-activity-worker"
  description   = "KudoWatch: process new Strava activities"
  role          = aws_iam_role.lambda["activity-worker"].arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "activity-worker.handler"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.lambda["activity-worker"].output_path
  source_code_hash = data.archive_file.lambda["activity-worker"].output_base64sha256

  environment {
    variables = local.common_lambda_environment
  }

  depends_on = [
    aws_cloudwatch_log_group.worker,
    aws_iam_role_policy.lambda_logs,
    aws_iam_role_policy.activity_worker,
  ]
}

resource "aws_lambda_event_source_mapping" "activity_queue" {
  event_source_arn = aws_sqs_queue.activity.arn
  function_name    = aws_lambda_function.activity_worker.arn
  batch_size       = 5
  enabled          = true

  function_response_types = ["ReportBatchItemFailures"]
}
