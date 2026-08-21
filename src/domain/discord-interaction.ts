export interface DiscordUser {
  readonly id: string;
  readonly username: string;
  readonly global_name?: string | null;
}

export interface DiscordInteraction {
  readonly type: number;
  readonly guild_id?: string;
  readonly data?: {
    readonly name?: string;
    readonly options?: readonly {
      readonly type?: number;
      readonly name?: string;
    }[];
  };
  readonly member?: {
    readonly nick?: string | null;
    readonly user?: DiscordUser;
  };
}

export function parseDiscordInteraction(body: string): DiscordInteraction {
  const parsed: unknown = JSON.parse(body);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as { readonly type?: unknown }).type !== "number"
  ) {
    throw new Error("Invalid Discord interaction format.");
  }

  return parsed as DiscordInteraction;
}

export function isStravaConnectCommand(
  interaction: DiscordInteraction,
): boolean {
  return (
    interaction.type === 2 &&
    interaction.data?.name === "strava" &&
    interaction.data.options?.some(
      (option) => option.type === 1 && option.name === "connect",
    ) === true
  );
}

export function discordDisplayName(interaction: DiscordInteraction): string {
  const user = interaction.member?.user;
  if (user === undefined) {
    throw new Error("The Discord interaction does not contain a user.");
  }

  return interaction.member?.nick ?? user.global_name ?? user.username;
}
