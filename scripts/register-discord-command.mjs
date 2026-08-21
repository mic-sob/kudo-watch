import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

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

const parsed = JSON.parse(secret.SecretString);
const botToken = parsed.discordBotToken;

if (typeof botToken !== "string" || botToken.length === 0) {
  throw new Error("The application secret does not contain a Discord bot token.");
}

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

const application = await applicationResponse.json();
if (typeof application.id !== "string") {
  throw new Error("Discord did not return an application ID.");
}

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

const command = await commandResponse.json();
console.log(`Zarejestrowano /strava connect (command ID: ${command.id}).`);
