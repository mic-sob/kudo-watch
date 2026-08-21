import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { StravaWebhookEvent } from "../domain/strava-event.js";

const client = new SQSClient({});

export async function enqueueActivityEvent(
  queueUrl: string,
  event: StravaWebhookEvent,
): Promise<void> {
  await client.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event),
    }),
  );
}

