import type {
  StravaAthlete,
  StravaTokenExchange,
} from "../domain/strava-auth.js";
import type { StravaActivity } from "../domain/strava-activity.js";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";

export function buildStravaAuthorizationUrl(input: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
}): string {
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "activity:read_all");
  url.searchParams.set("state", input.state);
  return url.toString();
}

function requiredString(
  value: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`Strava response is missing field: ${key}`);
  }

  return field;
}

function requiredNumber(
  value: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(`Strava response is missing field: ${key}`);
  }

  return field;
}

function optionalNumber(
  value: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined {
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field)
    ? field
    : undefined;
}

function parseAthlete(value: unknown): StravaAthlete {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Strava response does not contain athlete data.");
  }

  const athlete = value as Readonly<Record<string, unknown>>;
  return {
    id: requiredNumber(athlete, "id"),
    firstname: requiredString(athlete, "firstname"),
    lastname: requiredString(athlete, "lastname"),
  };
}

export async function exchangeStravaAuthorizationCode(input: {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly code: string;
}): Promise<StravaTokenExchange> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
  });

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Strava rejected the OAuth code exchange: ${response.status}.`);
  }

  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Strava returned an invalid OAuth response.");
  }

  const value = parsed as Readonly<Record<string, unknown>>;
  return {
    accessToken: requiredString(value, "access_token"),
    refreshToken: requiredString(value, "refresh_token"),
    expiresAt: requiredNumber(value, "expires_at"),
    athlete: parseAthlete(value.athlete),
  };
}

export async function refreshStravaToken(input: {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}): Promise<Omit<StravaTokenExchange, "athlete">> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Strava rejected the token refresh: ${response.status}.`);
  }

  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Strava returned an invalid token refresh response.");
  }

  const value = parsed as Readonly<Record<string, unknown>>;
  return {
    accessToken: requiredString(value, "access_token"),
    refreshToken: requiredString(value, "refresh_token"),
    expiresAt: requiredNumber(value, "expires_at"),
  };
}

export async function getStravaActivity(input: {
  readonly accessToken: string;
  readonly activityId: number;
}): Promise<StravaActivity> {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${input.activityId}`,
    {
      headers: { authorization: `Bearer ${input.accessToken}` },
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Strava did not return the activity: ${response.status}.`);
  }

  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Strava returned invalid activity data.");
  }

  const value = parsed as Readonly<Record<string, unknown>>;
  const sportType =
    typeof value.sport_type === "string"
      ? value.sport_type
      : requiredString(value, "type");

  return {
    id: requiredNumber(value, "id"),
    name: requiredString(value, "name"),
    sportType,
    distance: optionalNumber(value, "distance"),
    movingTime: optionalNumber(value, "moving_time"),
    totalElevationGain: optionalNumber(value, "total_elevation_gain"),
    averageSpeed: optionalNumber(value, "average_speed"),
    startDate: requiredString(value, "start_date"),
  };
}

export async function revokeStravaAuthorization(input: {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly token: string;
}): Promise<void> {
  const basicAuth = Buffer.from(
    `${input.clientId}:${input.clientSecret}`,
    "utf8",
  ).toString("base64");
  const body = new URLSearchParams({
    token: input.token,
    token_type_hint: "refresh_token",
  });

  const response = await fetch(STRAVA_REVOKE_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${basicAuth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Strava rejected the authorization revocation: ${response.status}.`);
  }
}
