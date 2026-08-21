export interface OAuthSession {
  readonly state: string;
  readonly discordUserId: string;
  readonly discordGuildId: string;
  readonly discordDisplayName: string;
  readonly expiresAt: number;
}

