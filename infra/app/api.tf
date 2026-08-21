locals {
  api_routes = {
    "POST /discord/interactions" = {
      method   = "POST"
      path     = "/discord/interactions"
      function = "discord-interactions"
    }
    "GET /oauth/strava/start" = {
      method   = "GET"
      path     = "/oauth/strava/start"
      function = "strava-oauth-start"
    }
    "GET /oauth/strava/callback" = {
      method   = "GET"
      path     = "/oauth/strava/callback"
      function = "strava-oauth-callback"
    }
    "GET /webhooks/strava" = {
      method   = "GET"
      path     = "/webhooks/strava"
      function = "strava-webhook"
    }
    "POST /webhooks/strava" = {
      method   = "POST"
      path     = "/webhooks/strava"
      function = "strava-webhook"
    }
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = local.name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = false
    throttling_burst_limit   = 50
    throttling_rate_limit    = 25
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each = local.http_lambdas

  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.http[each.key].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = each.value.timeout * 1000
}

resource "aws_apigatewayv2_route" "lambda" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.http.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value.function].id}"
}

resource "aws_lambda_permission" "api_gateway" {
  for_each = local.api_routes

  statement_id  = "AllowApiGateway${substr(sha1(each.key), 0, 12)}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.http[each.value.function].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/${each.value.method}${each.value.path}"
}
