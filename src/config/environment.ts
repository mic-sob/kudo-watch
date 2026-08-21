import { z } from "zod";
import { nonEmptyString } from "../utils/validation.js";

const environmentSchema = z.object({
  ACCOUNT_LINKS_TABLE_NAME: nonEmptyString,
  ACTIVITY_QUEUE_URL: nonEmptyString,
  DISCORD_GUILD_ID: nonEmptyString,
  KMS_KEY_ARN: nonEmptyString,
  PUBLIC_BASE_URL: nonEmptyString,
  SECRETS_ARN: nonEmptyString,
});

export interface Environment {
  readonly accountLinksTableName: string;
  readonly activityQueueUrl: string;
  readonly discordGuildId: string;
  readonly kmsKeyArn: string;
  readonly publicBaseUrl: string;
  readonly secretsArn: string;
}

export function readEnvironment(): Environment {
  const environment = environmentSchema.parse(process.env);

  return {
    accountLinksTableName: environment.ACCOUNT_LINKS_TABLE_NAME,
    activityQueueUrl: environment.ACTIVITY_QUEUE_URL,
    discordGuildId: environment.DISCORD_GUILD_ID,
    kmsKeyArn: environment.KMS_KEY_ARN,
    publicBaseUrl: environment.PUBLIC_BASE_URL.replace(/\/$/u, ""),
    secretsArn: environment.SECRETS_ARN,
  };
}
