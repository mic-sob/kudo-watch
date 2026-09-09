import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { z } from "zod";
import { nonEmptyString, parseJson } from "../utils/validation.js";

const applicationSecretsSchema = z.object({
  discordBotToken: nonEmptyString,
  discordPublicKey: nonEmptyString,
  discordWebhookUrl: nonEmptyString,
  stravaClientId: nonEmptyString,
  stravaClientSecret: nonEmptyString,
  stravaWebhookVerifyToken: nonEmptyString,
  geoapifyApiKey: nonEmptyString.optional(),
});

export type ApplicationSecrets = z.infer<typeof applicationSecretsSchema>;

const client = new SecretsManagerClient({});
let cachedSecrets: ApplicationSecrets | undefined;

function parseSecrets(secretString: string): ApplicationSecrets {
  return parseJson(applicationSecretsSchema, secretString);
}

export async function getApplicationSecrets(
  secretArn: string,
): Promise<ApplicationSecrets> {
  if (cachedSecrets !== undefined) {
    return cachedSecrets;
  }

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (response.SecretString === undefined) {
    throw new Error("The application secret is not a string value.");
  }

  cachedSecrets = parseSecrets(response.SecretString);
  return cachedSecrets;
}
