export interface StravaWebhookEvent {
  readonly object_type: "activity" | "athlete";
  readonly object_id: number;
  readonly aspect_type: "create" | "update" | "delete";
  readonly owner_id: number;
  readonly subscription_id: number;
  readonly event_time: number;
  readonly updates: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseStravaWebhookEvent(body: string): StravaWebhookEvent {
  const parsed: unknown = JSON.parse(body);

  if (
    !isRecord(parsed) ||
    (parsed.object_type !== "activity" && parsed.object_type !== "athlete") ||
    (parsed.aspect_type !== "create" &&
      parsed.aspect_type !== "update" &&
      parsed.aspect_type !== "delete") ||
    !isFiniteNumber(parsed.object_id) ||
    !isFiniteNumber(parsed.owner_id) ||
    !isFiniteNumber(parsed.subscription_id) ||
    !isFiniteNumber(parsed.event_time) ||
    !isRecord(parsed.updates)
  ) {
    throw new Error("Invalid Strava webhook event format.");
  }

  return {
    object_type: parsed.object_type,
    object_id: parsed.object_id,
    aspect_type: parsed.aspect_type,
    owner_id: parsed.owner_id,
    subscription_id: parsed.subscription_id,
    event_time: parsed.event_time,
    updates: parsed.updates,
  };
}

export function isActivityCreateEvent(
  event: StravaWebhookEvent,
): event is StravaWebhookEvent & {
  readonly object_type: "activity";
  readonly aspect_type: "create";
} {
  return event.object_type === "activity" && event.aspect_type === "create";
}
