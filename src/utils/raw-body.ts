import type { APIGatewayProxyEventV2 } from "aws-lambda";

export function rawBody(event: APIGatewayProxyEventV2): string {
  if (event.body === undefined) {
    return "";
  }

  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}