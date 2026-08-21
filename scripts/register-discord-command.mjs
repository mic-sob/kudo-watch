import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { z } from "zod";

const discordSecretSchema = z.object({
  discordBotToken: z.string().min(1),
});
const discordApplicationSchema = z.object({
  id: z.string().min(1),
});
const discordCommandSchema = z.object({
  id: z.string().min(1),
});

const [secretId, guildId] = process.argv.slice(2);

if (!secretId || !guildId) {
  throw new Error(
    "Usage: node scripts/register-discord-command.mjs SECRET_ARN GUILD_ID",
  );
}

const secretsManager = new SecretsManagerClient({ region: "eu-central-1" });
const secret = await secretsManager.send(
  new GetSecretValueCommand({ SecretId: secretId }),
);

if (!secret.SecretString) {
  throw new Error("The application secret does not contain a string value.");
}

const { discordBotToken: botToken } = discordSecretSchema.parse(
  JSON.parse(secret.SecretString),
);

const headers = {
  authorization: `Bot ${botToken}`,
  "content-type": "application/json",
};

const applicationResponse = await fetch(
  "https://discord.com/api/v10/oauth2/applications/@me",
  { headers },
);

if (!applicationResponse.ok) {
  throw new Error(
    `Discord rejected the bot token (HTTP ${applicationResponse.status}).`,
  );
}

const application = discordApplicationSchema.parse(
  await applicationResponse.json(),
);

const commandResponse = await fetch(
  `https://discord.com/api/v10/applications/${application.id}/guilds/${guildId}/commands`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "strava",
      description: "Zarządzaj połączeniem konta Strava z KudoWatch",
      options: [
        {
          type: 1,
          name: "connect",
          description: "Połącz swoje konto Strava z KudoWatch",
        },
      ],
    }),
  },
);

if (!commandResponse.ok) {
  const error = await commandResponse.text();
  throw new Error(
    `Failed to register the command (HTTP ${commandResponse.status}): ${error}`,
  );
}

const command = discordCommandSchema.parse(await commandResponse.json());
console.log(`Zarejestrowano /strava connect (command ID: ${command.id}).`);
