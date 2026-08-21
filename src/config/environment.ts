export interface Environment {
  readonly accountLinksTableName: string;
  readonly activityQueueUrl: string;
  readonly discordGuildId: string;
  readonly kmsKeyArn: string;
  readonly publicBaseUrl: string;
  readonly secretsArn: string;
}

function required(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readEnvironment(): Environment {
  return {
    accountLinksTableName: required("ACCOUNT_LINKS_TABLE_NAME"),
    activityQueueUrl: required("ACTIVITY_QUEUE_URL"),
    discordGuildId: required("DISCORD_GUILD_ID"),
    kmsKeyArn: required("KMS_KEY_ARN"),
    publicBaseUrl: required("PUBLIC_BASE_URL").replace(/\/$/u, ""),
    secretsArn: required("SECRETS_ARN"),
  };
}
