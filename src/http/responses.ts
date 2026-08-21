import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function jsonResponse(
  statusCode: number,
  body: Readonly<Record<string, unknown>>,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}

export function htmlResponse(
  statusCode: number,
  body: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "x-content-type-options": "nosniff",
    },
    body,
  };
}

