import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { readEnvironment } from "../config/environment.js";
import { getApplicationSecrets } from "../config/secrets.js";
import {
  isActivityCreateEvent,
  parseStravaWebhookEvent,
} from "../domain/strava-event.js";
import { jsonResponse } from "../http/responses.js";
import { enqueueActivityEvent } from "../queues/activity-queue.js";
import { rawBody } from "../utils/raw-body.js";

async function handleVerification(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const environment = readEnvironment();
  const secrets = await getApplicationSecrets(environment.secretsArn);
  const parameters = event.queryStringParameters ?? {};

  if (
    parameters["hub.mode"] !== "subscribe" ||
    parameters["hub.verify_token"] !== secrets.stravaWebhookVerifyToken ||
    parameters["hub.challenge"] === undefined
  ) {
    return jsonResponse(403, { message: "Invalid webhook verification." });
  }

  return jsonResponse(200, {
    "hub.challenge": parameters["hub.challenge"],
  });
}

async function handleEvent(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  let stravaEvent;

  try {
    stravaEvent = parseStravaWebhookEvent(rawBody(event));
  } catch (error) {
    console.error("Rejected an invalid Strava webhook.", error);
    return jsonResponse(400, { message: "Invalid Strava event." });
  }

  if (!isActivityCreateEvent(stravaEvent)) {
    return jsonResponse(200, { accepted: true, queued: false });
  }

  const environment = readEnvironment();
  try {
    await enqueueActivityEvent(environment.activityQueueUrl, stravaEvent);
    return jsonResponse(200, { accepted: true, queued: true });
  } catch (error) {
    console.error("Failed to enqueue the Strava webhook in SQS.", error);
    return jsonResponse(500, { message: "Failed to accept the event." });
  }
}

/**
 * Verifies Strava webhook subscriptions on GET and queues newly created
 * activity events in SQS on POST.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;

  if (method === "GET") {
    return handleVerification(event);
  }

  if (method === "POST") {
    return handleEvent(event);
  }

  return jsonResponse(405, { message: "Method not allowed." });
}
