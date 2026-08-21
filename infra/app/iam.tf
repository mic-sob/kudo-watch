locals {
  lambda_names = toset([
    "discord-interactions",
    "strava-oauth-start",
    "strava-oauth-callback",
    "strava-webhook",
    "activity-worker",
  ])
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  for_each = local.lambda_names

  name               = "${local.name}-${each.value}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "lambda_logs" {
  statement {
    sid    = "WriteLambdaLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/${local.name}-*:*"]
  }
}

resource "aws_iam_role_policy" "lambda_logs" {
  for_each = local.lambda_names

  name   = "cloudwatch-logs"
  role   = aws_iam_role.lambda[each.value].id
  policy = data.aws_iam_policy_document.lambda_logs.json
}

data "aws_iam_policy_document" "secrets_read" {
  statement {
    sid       = "ReadApplicationSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.application.arn]
  }
}

resource "aws_iam_role_policy" "secrets_read" {
  for_each = local.lambda_names

  name   = "read-application-secret"
  role   = aws_iam_role.lambda[each.value].id
  policy = data.aws_iam_policy_document.secrets_read.json
}

data "aws_iam_policy_document" "discord_interactions" {
  statement {
    sid       = "CreateOAuthSession"
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.application.arn]
  }

  statement {
    sid       = "DecryptDynamoDbTableKey"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.application.arn]
  }
}

resource "aws_iam_role_policy" "discord_interactions" {
  name   = "discord-interactions"
  role   = aws_iam_role.lambda["discord-interactions"].id
  policy = data.aws_iam_policy_document.discord_interactions.json
}

data "aws_iam_policy_document" "oauth_start" {
  statement {
    sid       = "ReadOAuthSession"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem"]
    resources = [aws_dynamodb_table.application.arn]
  }

  statement {
    sid       = "DecryptDynamoDbTableKey"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.application.arn]
  }
}

resource "aws_iam_role_policy" "oauth_start" {
  name   = "oauth-start"
  role   = aws_iam_role.lambda["strava-oauth-start"].id
  policy = data.aws_iam_policy_document.oauth_start.json
}

data "aws_iam_policy_document" "oauth_callback" {
  statement {
    sid    = "ManageAccountLinks"
    effect = "Allow"
    actions = [
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:TransactWriteItems",
      "dynamodb:UpdateItem",
    ]
    resources = [
      aws_dynamodb_table.application.arn,
      "${aws_dynamodb_table.application.arn}/index/*",
    ]
  }

  statement {
    sid    = "EncryptStravaTokens"
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:Encrypt",
    ]
    resources = [aws_kms_key.application.arn]
  }
}

resource "aws_iam_role_policy" "oauth_callback" {
  name   = "oauth-callback"
  role   = aws_iam_role.lambda["strava-oauth-callback"].id
  policy = data.aws_iam_policy_document.oauth_callback.json
}

data "aws_iam_policy_document" "strava_webhook" {
  statement {
    sid       = "EnqueueActivity"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.activity.arn]
  }
}

resource "aws_iam_role_policy" "strava_webhook" {
  name   = "strava-webhook"
  role   = aws_iam_role.lambda["strava-webhook"].id
  policy = data.aws_iam_policy_document.strava_webhook.json
}

data "aws_iam_policy_document" "activity_worker" {
  statement {
    sid    = "ProcessActivityRecords"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:TransactWriteItems",
      "dynamodb:UpdateItem",
    ]
    resources = [
      aws_dynamodb_table.application.arn,
      "${aws_dynamodb_table.application.arn}/index/*",
    ]
  }

  statement {
    sid    = "EncryptAndDecryptStravaTokens"
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:Encrypt",
    ]
    resources = [aws_kms_key.application.arn]
  }

  statement {
    sid    = "ConsumeActivityQueue"
    effect = "Allow"
    actions = [
      "sqs:ChangeMessageVisibility",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ReceiveMessage",
    ]
    resources = [aws_sqs_queue.activity.arn]
  }
}

resource "aws_iam_role_policy" "activity_worker" {
  name   = "activity-worker"
  role   = aws_iam_role.lambda["activity-worker"].id
  policy = data.aws_iam_policy_document.activity_worker.json
}
