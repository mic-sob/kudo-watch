import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { isDiscordGuildMember } from "../clients/discord-client.js";
import {
  exchangeStravaAuthorizationCode,
  revokeStravaAuthorization,
} from "../clients/strava-client.js";
import { readEnvironment } from "../config/environment.js";
import { getApplicationSecrets } from "../config/secrets.js";
import { decryptToken, encryptToken } from "../utils/token-encryption.js";
import type { AccountLink } from "../domain/account-link.js";
import {
  authorizationErrorPage,
  authorizationSuccessPage,
} from "../http/pages.js";
import { htmlResponse } from "../http/responses.js";
import {
  AccountRepository,
  StravaAccountAlreadyLinkedError,
} from "../repositories/account-repository.js";

function hasRequiredScope(scope: string | undefined): boolean {
  return (
    scope
      ?.split(/[ ,]+/u)
      .filter(Boolean)
      .includes("activity:read_all") === true
  );
}

function stravaDisplayName(firstname: string, lastname: string): string {
  const value = `${firstname} ${lastname}`.trim();
  return value.length > 0 ? value : "Użytkownik Stravy";
}

/**
 * Completes Strava OAuth, enforces one-to-one account linking, encrypts and
 * stores tokens, and revokes superseded authorizations when needed.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const parameters = event.queryStringParameters ?? {};
  if (parameters.error !== undefined) {
    return htmlResponse(
      400,
      authorizationErrorPage(
        "Nie udzielono dostępu do Stravy. Konto nie zostało połączone.",
      ),
    );
  }

  const state = parameters.state;
  const code = parameters.code;
  if (
    state === undefined ||
    code === undefined ||
    !hasRequiredScope(parameters.scope)
  ) {
    return htmlResponse(
      400,
      authorizationErrorPage(
        "Strava nie przekazała wymaganej zgody activity:read_all. Użyj ponownie komendy /strava connect i zaakceptuj wymagany dostęp.",
      ),
    );
  }

  const environment = readEnvironment();
  const secrets = await getApplicationSecrets(environment.secretsArn);
  const repository = new AccountRepository(environment.accountLinksTableName);
  const session = await repository.consumeOAuthSession(state);
  const nowEpoch = Math.floor(Date.now() / 1_000);

  if (
    session === undefined ||
    session.expiresAt <= nowEpoch ||
    session.discordGuildId !== environment.discordGuildId
  ) {
    return htmlResponse(
      400,
      authorizationErrorPage(
        "Link wygasł albo został już wykorzystany. Użyj ponownie komendy /strava connect.",
      ),
    );
  }

  const isMember = await isDiscordGuildMember({
    botToken: secrets.discordBotToken,
    guildId: session.discordGuildId,
    userId: session.discordUserId,
  });
  if (!isMember) {
    return htmlResponse(
      403,
      authorizationErrorPage(
        "Nie należysz już do serwera Discord. Konto nie zostało połączone.",
      ),
    );
  }

  let exchangedToken:
    | Awaited<ReturnType<typeof exchangeStravaAuthorizationCode>>
    | undefined;

  try {
    exchangedToken = await exchangeStravaAuthorizationCode({
      clientId: secrets.stravaClientId,
      clientSecret: secrets.stravaClientSecret,
      code,
    });

    const previousLink = await repository.getAccountLink(
      session.discordUserId,
    );
    const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
      encryptToken(environment.kmsKeyArn, exchangedToken.accessToken),
      encryptToken(environment.kmsKeyArn, exchangedToken.refreshToken),
    ]);
    const now = new Date().toISOString();
    const link: AccountLink = {
      discordUserId: session.discordUserId,
      discordGuildId: session.discordGuildId,
      discordDisplayName: session.discordDisplayName,
      stravaAthleteId: exchangedToken.athlete.id,
      stravaDisplayName: stravaDisplayName(
        exchangedToken.athlete.firstname,
        exchangedToken.athlete.lastname,
      ),
      status: "active",
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt: exchangedToken.expiresAt,
      createdAt: previousLink?.createdAt ?? now,
      updatedAt: now,
    };

    await repository.saveAccountLink(link, previousLink);

    if (
      previousLink !== undefined &&
      previousLink.stravaAthleteId !== link.stravaAthleteId
    ) {
      try {
        const previousRefreshToken = await decryptToken(
          previousLink.encryptedRefreshToken,
        );
        await revokeStravaAuthorization({
          clientId: secrets.stravaClientId,
          clientSecret: secrets.stravaClientSecret,
          token: previousRefreshToken,
        });
      } catch (error) {
        console.error("Failed to revoke the previous Strava authorization.", error);
      }
    }

    return htmlResponse(200, authorizationSuccessPage());
  } catch (error) {
    if (
      error instanceof StravaAccountAlreadyLinkedError &&
      exchangedToken !== undefined
    ) {
      try {
        await revokeStravaAuthorization({
          clientId: secrets.stravaClientId,
          clientSecret: secrets.stravaClientSecret,
          token: exchangedToken.refreshToken,
        });
      } catch (revokeError) {
        console.error(
          "Failed to revoke the rejected Strava authorization.",
          revokeError,
        );
      }

      return htmlResponse(
        409,
        authorizationErrorPage(
          "To konto Strava jest już połączone z innym kontem Discord.",
        ),
      );
    }

    console.error("Failed to complete Strava OAuth.", error);
    return htmlResponse(
      500,
      authorizationErrorPage(
        "Wystąpił błąd podczas łączenia konta. Użyj ponownie komendy /strava connect.",
      ),
    );
  }
}
