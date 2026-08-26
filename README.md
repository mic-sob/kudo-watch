# KudoWatch

KudoWatch publishes newly created Strava activities from connected Discord
members to a selected Discord channel. Members connect their accounts with the
`/strava connect` command. Strava events are delivered through a webhook,
queued in SQS, and processed by an AWS Lambda worker.

## Architecture

- Discord HTTP interactions for `/strava connect`
- Strava OAuth 2.0 with the `activity:read_all` scope
- Strava webhook for new activity events
- AWS Lambda and API Gateway
- Amazon SQS with a dead-letter queue
- Amazon DynamoDB with point-in-time recovery
- AWS KMS for Strava token encryption
- AWS Secrets Manager for Discord and Strava credentials
- Terraform for infrastructure provisioning

## Requirements

- Node.js 24
- pnpm 11
- Terraform compatible with the version constraint in
  [`infra/app/versions.tf`](infra/app/versions.tf)
- AWS CLI authenticated to the target AWS account
- an S3 bucket for Terraform state
- a Discord application and a Discord server
- a Strava account with API application access

Select Node.js 24 and install the dependencies:

```bash
nvm use 24
pnpm install
```

## Build

Lambda packages must be built before running Terraform:

```bash
pnpm typecheck
pnpm clean
pnpm build
```

## Infrastructure

Initialize the application state backend with an existing, versioned S3
bucket:

```bash
cd infra/app
terraform init -backend-config='bucket=YOUR_TERRAFORM_STATE_BUCKET'
```

Plan and deploy the application for the target Discord server:

```bash
terraform plan \
  -var='discord_guild_id=YOUR_DISCORD_GUILD_ID' \
  -out=kudowatch.tfplan
terraform apply kudowatch.tfplan
```

The relevant Terraform outputs are:

- `application_secret_arn`
- `discord_interactions_url`
- `strava_oauth_callback_url`
- `strava_webhook_url`

## Secrets Manager

Terraform creates the Secrets Manager secret but does not manage its value.
Set the secret value manually as the following JSON object:

```json
{
  "discordBotToken": "...",
  "discordPublicKey": "...",
  "discordWebhookUrl": "...",
  "stravaClientId": "...",
  "stravaClientSecret": "...",
  "stravaWebhookVerifyToken": "...",
  "stadiaMapsApiKey": "..."
}
```

The fields contain:

| Field | Source |
| --- | --- |
| `discordBotToken` | Discord Developer Portal, **Bot → Token** |
| `discordPublicKey` | Discord Developer Portal, **General Information → Public Key** |
| `discordWebhookUrl` | Discord channel settings, **Integrations → Webhooks** |
| `stravaClientId` | Strava API application settings, **Client ID** |
| `stravaClientSecret` | Strava API application settings, **Client Secret** |
| `stravaWebhookVerifyToken` | A random value generated for webhook verification |
| `stadiaMapsApiKey` | Stadia Maps client dashboard, **Authentication Configuration → API key** |

Generate a webhook verification token with:

```bash
openssl rand -hex 32
```

Never commit secret values, place them in Terraform variables, or paste them
into Terraform state. Treat the Discord webhook URL as a credential because it
can be used to publish messages to the configured channel.

## Discord configuration

### Install the application on the server

1. Open the application in the
   [Discord Developer Portal](https://discord.com/developers/applications).
2. Open **Installation** and enable **Guild Install**.
3. Select **Discord Provided Link** as the install link.
4. In **Default Install Settings → Guild Install**, add the scopes:
   - `applications.commands`
   - `bot`
5. No additional bot permissions are required. Activity messages are sent by
   the incoming webhook rather than by the bot.
6. Open the generated install link and add the application to the target
   Discord server.

The bot may appear offline. KudoWatch uses HTTP interactions and does not keep
a Discord Gateway connection open.

### Create the channel webhook

1. Open the settings of the target Discord channel.
2. Select **Integrations → Webhooks → New Webhook**.
3. Name it `KudoWatch` and select the target channel.
4. Copy its URL into `discordWebhookUrl` in Secrets Manager.

### Configure the interactions endpoint

1. Copy the `discord_interactions_url` Terraform output.
2. In the Discord Developer Portal, open **General Information**.
3. Paste the URL into **Interactions Endpoint URL** and save it.
4. Discord sends a signed verification request. The endpoint must be accepted
   before commands can be used.

### Register the slash command

From the repository root, run:

```bash
pnpm discord:register \
  'YOUR_APPLICATION_SECRET_ARN' \
  'YOUR_DISCORD_GUILD_ID'
```

The script reads the bot token directly from Secrets Manager and registers the
guild command `/strava connect`. It does not print the bot token.

## Strava configuration

### Create the API application

1. Open [Strava API Settings](https://www.strava.com/settings/api).
2. Create an application named `KudoWatch`.
3. Set its website to the public API base URL or another project website.
4. Set **Authorization Callback Domain** to the hostname from the
   `strava_oauth_callback_url` Terraform output.

For example, if the callback output is:

```text
https://example.execute-api.eu-central-1.amazonaws.com/oauth/strava/callback
```

the callback domain must be:

```text
example.execute-api.eu-central-1.amazonaws.com
```

Do not include `https://`, a path, a trailing slash, spaces, or multiple
comma-separated domains.

Copy the application Client ID and Client Secret into Secrets Manager. Access
and refresh tokens shown by Strava are not used for application configuration;
KudoWatch obtains per-user tokens through OAuth.

### Register the Strava webhook

After the secret value is complete, run from the repository root:

```bash
pnpm strava:webhook:register \
  'YOUR_APPLICATION_SECRET_ARN' \
  'YOUR_STRAVA_WEBHOOK_URL'
```

Use the `strava_webhook_url` Terraform output as the second argument. The
script:

- reads Strava credentials directly from Secrets Manager;
- checks for an existing subscription;
- reuses a subscription with the same callback URL;
- refuses to delete or replace a conflicting subscription automatically;
- registers the webhook verification token without printing it.

## End-to-end verification

1. Run `/strava connect` on the configured Discord server.
2. Open the private authorization link returned by Discord.
3. Confirm the warning and authorize `activity:read_all` in Strava.
4. Create a new Strava activity after the webhook subscription is active.
5. Confirm that KudoWatch publishes the activity details and Strava link to the
   configured Discord channel.

KudoWatch requests `activity:read_all`, so activities marked **Only You** may
also be published to the shared Discord channel after the athlete explicitly
authorizes that access.

## Known issues (alpha)

- Strava athlete deauthorization events are currently acknowledged but not
  processed. A revoked account link can therefore remain active in DynamoDB and
  may require manual cleanup before the same Strava account can be linked again.
- Concurrent OAuth callbacks for the same Discord user are not protected by an
  optimistic version check. Linking two different Strava accounts at the same
  time can leave a stale ownership record.
- The activity worker processes up to five SQS records sequentially within a
  30-second Lambda timeout. A slow external dependency can cause retries for an
  otherwise healthy batch.
- If OAuth fails after Strava has issued tokens but before DynamoDB persists the
  account link, the new Strava authorization is not revoked automatically for
  every failure type.
- The Discord interaction handler performs external work before sending its
  initial response. Cold starts or a slow Discord API response can exceed
  Discord's response deadline.
- Automated tests and CI are not included in the alpha release.

## Operational notes

- Activity delivery is at least once. A rare failure after Discord accepts a
  message but before DynamoDB records completion can produce a duplicate.
- Duplicate webhook deliveries are normally deduplicated in DynamoDB.
- If a connected user is no longer a member of the configured Discord server,
  KudoWatch revokes the Strava authorization and deactivates the account link.
- Failed activity events are retried through SQS and eventually moved to the
  dead-letter queue.

## License

KudoWatch is released under the [MIT License](LICENSE), SPDX identifier `MIT`.
It permits use, copying, modification, and distribution, provided that the
copyright and license notices are retained.
