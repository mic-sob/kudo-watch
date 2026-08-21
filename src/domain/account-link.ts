export type AccountLinkStatus = "active" | "inactive";

export interface AccountLink {
  readonly discordUserId: string;
  readonly discordGuildId: string;
  readonly stravaAthleteId: number;
  readonly discordDisplayName: string;
  readonly stravaDisplayName: string;
  readonly status: AccountLinkStatus;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken: string;
  readonly accessTokenExpiresAt: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
