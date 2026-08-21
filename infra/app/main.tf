locals {
  name = "kudowatch-${var.environment}"
}

resource "aws_kms_key" "application" {
  description             = "Encrypt Strava tokens used by KudoWatch"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "application" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.application.key_id
}

resource "aws_dynamodb_table" "application" {
  name         = local.name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI1PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI1SK"
      key_type       = "RANGE"
    }
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.application.arn
  }
}

resource "aws_sqs_queue" "activity_dlq" {
  name                      = "${local.name}-activity-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "activity" {
  name                       = "${local.name}-activity"
  visibility_timeout_seconds = 180
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.activity_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_secretsmanager_secret" "application" {
  name                    = local.name
  description             = "Discord and Strava secrets for KudoWatch"
  recovery_window_in_days = 30

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "http" {
  for_each = toset([
    "discord-interactions",
    "strava-oauth-start",
    "strava-oauth-callback",
    "strava-webhook",
  ])

  name              = "/aws/lambda/${local.name}-${each.value}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${local.name}-activity-worker"
  retention_in_days = 30
}
