import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { isDiscordGuildMember } from "../clients/discord-client.js";
import { publishDiscordActivity } from "../clients/discord-webhook-client.js";
import { getGeoapifyActivityMap } from "../clients/geoapify-maps-client.js";
import {
  getStravaActivity,
  revokeStravaAuthorization,
} from "../clients/strava-client.js";
import { readEnvironment } from "../config/environment.js";
import { getApplicationSecrets } from "../config/secrets.js";
import { decryptToken } from "../utils/token-encryption.js";
import {
  isActivityCreateEvent,
  parseStravaWebhookEvent,
} from "../domain/strava-event.js";
import { buildActivityEmbed } from "../messages/activity-message.js";
import { AccountRepository } from "../repositories/account-repository.js";
import { getValidStravaAccessToken } from "../services/strava-access.js";

const ACTIVITY_MAP_FILENAME = "activity-map.png";

async function processRecord(body: string): Promise<void> {
  const event = parseStravaWebhookEvent(body);
  if (!isActivityCreateEvent(event)) {
    return;
  }

  const environment = readEnvironment();
  const repository = new AccountRepository(environment.accountLinksTableName);
  const link = await repository.findAccountLinkByStravaAthleteId(event.owner_id);
  if (link === undefined || link.status !== "active") {
    return;
  }

  const claim = await repository.claimActivityEvent(event.object_id);
  if (claim === "published") {
    return;
  }

  if (claim === "busy") {
    throw new Error("The activity event is being processed by another worker.");
  }

  try {
    const secrets = await getApplicationSecrets(environment.secretsArn);
    const isMember = await isDiscordGuildMember({
      botToken: secrets.discordBotToken,
      guildId: link.discordGuildId,
      userId: link.discordUserId,
    });

    if (!isMember) {
      const refreshToken = await decryptToken(link.encryptedRefreshToken);
      await revokeStravaAuthorization({
        clientId: secrets.stravaClientId,
        clientSecret: secrets.stravaClientSecret,
        token: refreshToken,
      });
      await repository.deactivateAccountLink(
        link.discordUserId,
        link.stravaAthleteId,
      );
      await repository.markActivityPublished(event.object_id);
      return;
    }

    const accessToken = await getValidStravaAccessToken({
      link,
      repository,
      secrets,
      kmsKeyArn: environment.kmsKeyArn,
    });
    const activity = await getStravaActivity({
      accessToken,
      activityId: event.object_id,
    });

    const polyline =
      activity.map?.polyline ?? activity.map?.summaryPolyline;
    let mapImage: ArrayBuffer | undefined;
    if (polyline) {
      if (secrets.geoapifyApiKey === undefined) {
        console.warn("Geoapify API key is missing; publishing without a map.");
      } else {
        try {
          mapImage = await getGeoapifyActivityMap({
            apiKey: secrets.geoapifyApiKey,
            polyline,
          });
        } catch {
          // Fetch errors can include the URL containing the API key.
          console.warn(
            `Failed to fetch the map for activity ${event.object_id}; publishing without a map.`,
          );
        }
      }
    }

    await publishDiscordActivity({
      webhookUrl: secrets.discordWebhookUrl,
      embed: buildActivityEmbed(
        link,
        activity,
        mapImage === undefined ? undefined : ACTIVITY_MAP_FILENAME,
      ),
      ...(mapImage === undefined
        ? {}
        : {
            attachment: {
              data: mapImage,
              filename: ACTIVITY_MAP_FILENAME,
              contentType: "image/png",
            },
          }),
    });
    await repository.markActivityPublished(event.object_id);
  } catch (error) {
    try {
      await repository.releaseActivityClaim(event.object_id);
    } catch (releaseError) {
      console.error("Failed to release the activity claim.", releaseError);
    }

    throw error;
  }
}

/**
 * Processes Strava activity events from SQS, publishes eligible activities to
 * Discord, and reports individual record failures for retry.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record.body);
    } catch (error) {
      console.error(
        `Failed to process SQS message ${record.messageId}.`,
        error,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return {
    batchItemFailures,
  };
}
