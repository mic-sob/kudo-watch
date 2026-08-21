import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { buildStravaAuthorizationUrl } from "../clients/strava-client.js";
import { readEnvironment } from "../config/environment.js";
import { getApplicationSecrets } from "../config/secrets.js";
import {
  authorizationErrorPage,
  authorizationNoticePage,
} from "../http/pages.js";
import { htmlResponse } from "../http/responses.js";
import { AccountRepository } from "../repositories/account-repository.js";

/**
 * Validates a short-lived Discord OAuth session and displays the consent page
 * that redirects the user to Strava authorization.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const state = event.queryStringParameters?.state;
  if (state === undefined || state.length === 0) {
    return htmlResponse(
      400,
      authorizationErrorPage(
        "Brakuje identyfikatora połączenia. Użyj ponownie komendy /strava connect.",
      ),
    );
  }

  const environment = readEnvironment();
  const repository = new AccountRepository(environment.accountLinksTableName);
  const session = await repository.getOAuthSession(state);
  const now = Math.floor(Date.now() / 1_000);

  if (
    session === undefined ||
    session.expiresAt <= now ||
    session.discordGuildId !== environment.discordGuildId
  ) {
    return htmlResponse(
      400,
      authorizationErrorPage(
        "Link wygasł albo został już wykorzystany. Użyj ponownie komendy /strava connect.",
      ),
    );
  }

  const secrets = await getApplicationSecrets(environment.secretsArn);
  const redirectUri = `${environment.publicBaseUrl}/oauth/strava/callback`;
  const authorizationUrl = buildStravaAuthorizationUrl({
    clientId: secrets.stravaClientId,
    redirectUri,
    state,
  });

  return htmlResponse(200, authorizationNoticePage(authorizationUrl));
}
