import { z } from "zod";
import type { StravaTokenExchange } from "../domain/strava-auth.js";
import type { StravaActivity } from "../domain/strava-activity.js";
import { nonEmptyString } from "../utils/validation.js";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
const stravaAthleteSchema = z.object({
  id: z.number().int().nonnegative(),
  firstname: nonEmptyString,
  lastname: nonEmptyString,
});

const stravaTokenSchema = z.object({
  access_token: nonEmptyString,
  refresh_token: nonEmptyString,
  expires_at: z.number().int().nonnegative(),
});

const stravaTokenExchangeSchema = stravaTokenSchema.extend({
  athlete: stravaAthleteSchema,
});

const polylineMapSchema = z
  .object({
    id: nonEmptyString,
    polyline: z.string().nullable().optional(),
    summary_polyline: z.string().nullable().optional(),
  })
  .transform((map) => ({
    id: map.id,
    polyline: map.polyline || undefined,
    summaryPolyline: map.summary_polyline || undefined,
  }));

const stravaActivitySchema = z
  .object({
    id: z.number().int().nonnegative(),
    name: nonEmptyString,
    sport_type: nonEmptyString.optional(),
    type: nonEmptyString.optional(),
    distance: z.number().finite().optional(),
    moving_time: z.number().finite().optional(),
    total_elevation_gain: z.number().finite().optional(),
    average_speed: z.number().finite().optional(),
    start_date: nonEmptyString,
    map: polylineMapSchema.nullable().optional(),
  })
  .transform((activity, context): StravaActivity => {
    const sportType = activity.sport_type ?? activity.type;
    if (sportType === undefined) {
      context.addIssue({
        code: "custom",
        path: ["sport_type"],
        message: "Expected sport_type or type.",
      });
      return z.NEVER;
    }

    return {
      id: activity.id,
      name: activity.name,
      sportType,
      distance: activity.distance,
      movingTime: activity.moving_time,
      totalElevationGain: activity.total_elevation_gain,
      averageSpeed: activity.average_speed,
      startDate: activity.start_date,
      map: activity.map ?? undefined,
    };
  });

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

  const value = stravaTokenExchangeSchema.parse(await response.json());
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: value.expires_at,
    athlete: value.athlete,
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

  const value = stravaTokenSchema.parse(await response.json());
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: value.expires_at,
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

  return stravaActivitySchema.parse(await response.json());
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
