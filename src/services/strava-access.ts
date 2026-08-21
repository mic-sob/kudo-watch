import { refreshStravaToken } from "../clients/strava-client.js";
import type { ApplicationSecrets } from "../config/secrets.js";
import { decryptToken, encryptToken } from "../crypto/token-encryption.js";
import type { AccountLink } from "../domain/account-link.js";
import { AccountRepository } from "../repositories/account-repository.js";

const EXPIRY_MARGIN_SECONDS = 60;

export async function getValidStravaAccessToken(input: {
  readonly link: AccountLink;
  readonly repository: AccountRepository;
  readonly secrets: ApplicationSecrets;
  readonly kmsKeyArn: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  if (input.link.accessTokenExpiresAt > now + EXPIRY_MARGIN_SECONDS) {
    return decryptToken(input.link.encryptedAccessToken);
  }

  const refreshToken = await decryptToken(input.link.encryptedRefreshToken);
  const refreshed = await refreshStravaToken({
    clientId: input.secrets.stravaClientId,
    clientSecret: input.secrets.stravaClientSecret,
    refreshToken,
  });
  const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
    encryptToken(input.kmsKeyArn, refreshed.accessToken),
    encryptToken(input.kmsKeyArn, refreshed.refreshToken),
  ]);

  const updated = await input.repository.updateStravaTokens({
    discordUserId: input.link.discordUserId,
    previousEncryptedRefreshToken: input.link.encryptedRefreshToken,
    encryptedAccessToken,
    encryptedRefreshToken,
    accessTokenExpiresAt: refreshed.expiresAt,
  });

  if (updated) {
    return refreshed.accessToken;
  }

  const currentLink = await input.repository.getAccountLink(
    input.link.discordUserId,
  );
  if (
    currentLink === undefined ||
    currentLink.status !== "active" ||
    currentLink.accessTokenExpiresAt <= now
  ) {
    throw new Error("Failed to persist the refreshed Strava token.");
  }

  return decryptToken(currentLink.encryptedAccessToken);
}
