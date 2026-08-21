import { randomUUID } from "node:crypto";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { isDiscordGuildMember } from "../clients/discord-client.js";
import { readEnvironment } from "../config/environment.js";
import { getApplicationSecrets } from "../config/secrets.js";
import { verifyDiscordSignature } from "../crypto/discord-signature.js";
import {
  discordDisplayName,
  isStravaConnectCommand,
  parseDiscordInteraction,
} from "../domain/discord-interaction.js";
import { jsonResponse } from "../http/responses.js";
import { AccountRepository } from "../repositories/account-repository.js";

const OAUTH_LINK_LIFETIME_SECONDS = 10 * 60;
const EPHEMERAL_MESSAGE_FLAG = 64;

function rawBody(event: APIGatewayProxyEventV2): string {
  if (event.body === undefined) {
    return "";
  }

  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

function ephemeralMessage(content: string): APIGatewayProxyStructuredResultV2 {
  return jsonResponse(200, {
    type: 4,
    data: { content, flags: EPHEMERAL_MESSAGE_FLAG },
  });
}

/**
 * Verifies Discord interactions and handles `/strava connect` by creating a
 * short-lived OAuth session and returning an ephemeral authorization link.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const environment = readEnvironment();
  const secrets = await getApplicationSecrets(environment.secretsArn);
  const body = rawBody(event);
  const signature = event.headers["x-signature-ed25519"];
  const timestamp = event.headers["x-signature-timestamp"];

  if (
    signature === undefined ||
    timestamp === undefined ||
    !verifyDiscordSignature({
      body,
      publicKeyHex: secrets.discordPublicKey,
      signatureHex: signature,
      timestamp,
    })
  ) {
    return jsonResponse(401, { message: "Niepoprawny podpis Discorda." });
  }

  try {
    const interaction = parseDiscordInteraction(body);

    if (interaction.type === 1) {
      return jsonResponse(200, { type: 1 });
    }

    if (!isStravaConnectCommand(interaction)) {
      return ephemeralMessage("Nieobsługiwana komenda.");
    }

    const guildId = interaction.guild_id;
    const userId = interaction.member?.user?.id;
    if (
      guildId === undefined ||
      userId === undefined ||
      guildId !== environment.discordGuildId
    ) {
      return ephemeralMessage("Ta komenda działa tylko na serwerze KudoWatch.");
    }

    const isMember = await isDiscordGuildMember({
      botToken: secrets.discordBotToken,
      guildId,
      userId,
    });
    if (!isMember) {
      return ephemeralMessage("Nie jesteś członkiem tego serwera Discord.");
    }

    const state = randomUUID();
    const repository = new AccountRepository(
      environment.accountLinksTableName,
    );
    await repository.createOAuthSession({
      state,
      discordUserId: userId,
      discordGuildId: guildId,
      discordDisplayName: discordDisplayName(interaction),
      expiresAt:
        Math.floor(Date.now() / 1_000) + OAUTH_LINK_LIFETIME_SECONDS,
    });

    const connectUrl = new URL("/oauth/strava/start", environment.publicBaseUrl);
    connectUrl.searchParams.set("state", state);

    return jsonResponse(200, {
      type: 4,
      data: {
        content:
          "Link jest ważny przez 10 minut. Autoryzacja pozwoli KudoWatch publikować również aktywności oznaczone jako „Tylko Ty”.",
        flags: EPHEMERAL_MESSAGE_FLAG,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: "Połącz konto Strava",
                url: connectUrl.toString(),
              },
            ],
          },
        ],
      },
    });
  } catch (error) {
    console.error("Failed to handle the Discord interaction.", error);
    return ephemeralMessage("Wystąpił błąd. Spróbuj ponownie za chwilę.");
  }
}
