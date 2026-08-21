import { z } from "zod";
import { parseJson } from "../utils/validation.js";

const identifier = z.number().int().nonnegative();
const stravaWebhookEventSchema = z.object({
  object_type: z.enum(["activity", "athlete"]),
  object_id: identifier,
  aspect_type: z.enum(["create", "update", "delete"]),
  owner_id: identifier,
  subscription_id: identifier,
  event_time: identifier,
  updates: z.record(z.string(), z.unknown()),
});

export type StravaWebhookEvent = z.infer<typeof stravaWebhookEventSchema>;

export function parseStravaWebhookEvent(body: string): StravaWebhookEvent {
  return parseJson(stravaWebhookEventSchema, body);
}

export function isActivityCreateEvent(
  event: StravaWebhookEvent,
): event is StravaWebhookEvent & {
  readonly object_type: "activity";
  readonly aspect_type: "create";
} {
  return event.object_type === "activity" && event.aspect_type === "create";
}
