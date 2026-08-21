import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const [secretId, callbackUrl] = process.argv.slice(2);

if (!secretId || !callbackUrl) {
  throw new Error(
    "Usage: node scripts/register-strava-webhook.mjs SECRET_ARN CALLBACK_URL",
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
const clientId = parsed.stravaClientId;
const clientSecret = parsed.stravaClientSecret;
const verifyToken = parsed.stravaWebhookVerifyToken;

for (const [name, value] of Object.entries({
  stravaClientId: clientId,
  stravaClientSecret: clientSecret,
  stravaWebhookVerifyToken: verifyToken,
})) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The application secret is missing field: ${name}`);
  }
}

const subscriptionsUrl = new URL(
  "https://www.strava.com/api/v3/push_subscriptions",
);
subscriptionsUrl.searchParams.set("client_id", clientId);
subscriptionsUrl.searchParams.set("client_secret", clientSecret);

const listResponse = await fetch(subscriptionsUrl);
if (!listResponse.ok) {
  throw new Error(
    `Failed to retrieve Strava subscriptions (HTTP ${listResponse.status}).`,
  );
}

const subscriptions = await listResponse.json();
if (!Array.isArray(subscriptions)) {
  throw new Error("Strava returned an invalid subscription list.");
}

const matching = subscriptions.find(
  (subscription) => subscription.callback_url === callbackUrl,
);
if (matching) {
  console.log(`Webhook Stravy jest już aktywny (subscription ID: ${matching.id}).`);
  process.exit(0);
}

if (subscriptions.length > 0) {
  const existing = subscriptions
    .map((subscription) => `${subscription.id}: ${subscription.callback_url}`)
    .join(", ");
  throw new Error(
    `The application already has a different webhook subscription (${existing}). It was not removed.`,
  );
}

const body = new URLSearchParams({
  client_id: clientId,
  client_secret: clientSecret,
  callback_url: callbackUrl,
  verify_token: verifyToken,
});

const createResponse = await fetch(
  "https://www.strava.com/api/v3/push_subscriptions",
  {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  },
);

if (!createResponse.ok) {
  const error = await createResponse.text();
  throw new Error(
    `Failed to create the Strava webhook (HTTP ${createResponse.status}): ${error}`,
  );
}

const subscription = await createResponse.json();
console.log(`Utworzono webhook Stravy (subscription ID: ${subscription.id}).`);
