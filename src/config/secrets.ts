import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export interface ApplicationSecrets {
  readonly discordBotToken: string;
  readonly discordPublicKey: string;
  readonly discordWebhookUrl: string;
  readonly stravaClientId: string;
  readonly stravaClientSecret: string;
  readonly stravaWebhookVerifyToken: string;
}

const client = new SecretsManagerClient({});
let cachedSecrets: ApplicationSecrets | undefined;

function requiredString(
  value: Readonly<Record<string, unknown>>,
  key: keyof ApplicationSecrets,
): string {
  const field = value[key];

  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`The application secret is missing field: ${key}`);
  }

  return field;
}

function parseSecrets(secretString: string): ApplicationSecrets {
  const parsed: unknown = JSON.parse(secretString);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The application secret must be a JSON object.");
  }

  const value = parsed as Readonly<Record<string, unknown>>;

  return {
    discordBotToken: requiredString(value, "discordBotToken"),
    discordPublicKey: requiredString(value, "discordPublicKey"),
    discordWebhookUrl: requiredString(value, "discordWebhookUrl"),
    stravaClientId: requiredString(value, "stravaClientId"),
    stravaClientSecret: requiredString(value, "stravaClientSecret"),
    stravaWebhookVerifyToken: requiredString(
      value,
      "stravaWebhookVerifyToken",
    ),
  };
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
