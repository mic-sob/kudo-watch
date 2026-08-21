const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

export async function isDiscordGuildMember(input: {
  readonly botToken: string;
  readonly guildId: string;
  readonly userId: string;
}): Promise<boolean> {
  const response = await fetch(
    `${DISCORD_API_BASE_URL}/guilds/${encodeURIComponent(input.guildId)}/members/${encodeURIComponent(input.userId)}`,
    {
      headers: {
        authorization: `Bot ${input.botToken}`,
      },
      signal: AbortSignal.timeout(2_000),
    },
  );

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(
      `Discord API returned ${response.status} while checking guild membership.`,
    );
  }

  return true;
}
