import type { AccountLink } from "../domain/account-link.js";
import type { StravaActivity } from "../domain/strava-activity.js";

export interface DiscordEmbedField {
  readonly name: string;
  readonly value: string;
  readonly inline: boolean;
}

export interface DiscordEmbed {
  readonly color: number;
  readonly author: { readonly name: string };
  readonly title: string;
  readonly url: string;
  readonly fields: readonly DiscordEmbedField[];
  readonly image?: { readonly url: string };
}

const PACE_ACTIVITY_TYPES = new Set([
  "Run",
  "TrailRun",
  "VirtualRun",
  "Walk",
  "Hike",
]);

const ACTIVITY_NAMES: Readonly<Record<string, string>> = {
  Run: "Bieg",
  TrailRun: "Bieg terenowy",
  VirtualRun: "Bieg wirtualny",
  Ride: "Jazda na rowerze",
  MountainBikeRide: "Kolarstwo górskie",
  GravelRide: "Gravel",
  VirtualRide: "Jazda wirtualna",
  Walk: "Spacer",
  Hike: "Wędrówka",
  Swim: "Pływanie",
  WeightTraining: "Trening siłowy",
  Workout: "Trening",
  Yoga: "Joga",
};

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
    : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function formatPace(movingTime: number, distance: number): string | undefined {
  if (movingTime <= 0 || distance <= 0) {
    return undefined;
  }

  return `${formatDuration(movingTime / (distance / 1_000))} min/km`;
}

function field(name: string, value: string): DiscordEmbedField {
  return { name, value, inline: true };
}

export function buildActivityEmbed(
  link: AccountLink,
  activity: StravaActivity,
  mapImageFilename: string | undefined,
): DiscordEmbed {
  const fields: DiscordEmbedField[] = [
    field("Typ", ACTIVITY_NAMES[activity.sportType] ?? activity.sportType),
    field(
      "Data",
      new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Warsaw",
      }).format(new Date(activity.startDate)),
    ),
  ];

  const activityHasDistance = activity.distance !== undefined && activity.distance > 0
  if (activityHasDistance) {
    fields.push(field("Dystans", `${(activity.distance / 1_000).toFixed(2)} km`));
  }

  const activityHasMovingTime = activity.movingTime !== undefined && activity.movingTime > 0
  if (activityHasMovingTime) {
    fields.push(field("Czas ruchu", formatDuration(activity.movingTime)));
  }

  const activityHasPace = PACE_ACTIVITY_TYPES.has(activity.sportType) &&
    activity.movingTime !== undefined &&
    activity.distance !== undefined;

  const activityHasAverageSpeed = activity.averageSpeed !== undefined && activity.averageSpeed > 0

  if (activityHasPace) {
    const pace = formatPace(activity.movingTime, activity.distance);
    if (pace !== undefined) {
      fields.push(field("Tempo", pace));
    }
  } else if (activityHasAverageSpeed) {
    fields.push(
      field("Średnia prędkość", `${(activity.averageSpeed * 3.6).toFixed(1)} km/h`),
    );
  }

  const activityHasElevation = activity.totalElevationGain !== undefined && activity.totalElevationGain > 0
  if (activityHasElevation) {
    fields.push(
      field("Przewyższenie", `${Math.round(activity.totalElevationGain)} m`),
    );
  }

  const image =
    mapImageFilename === undefined
      ? undefined
      : { url: `attachment://${mapImageFilename}` };

  return {
    color: 0xfc4c02,
    author: {
      name: `${link.discordDisplayName} (${link.stravaDisplayName})`,
    },
    title: activity.name,
    url: `https://www.strava.com/activities/${activity.id}`,
    fields,
    ...(image === undefined ? {} : { image }),
  };
}
