# KudoWatch infrastructure

## State bootstrap

After creating the AWS account, run:

```bash
cd infra/bootstrap
terraform init
terraform apply -var='state_bucket_name=GLOBALLY-UNIQUE-NAME'
```

The bootstrap configuration uses its own local state. Keep it in a safe place.
The bucket has versioning enabled and is protected with `prevent_destroy`.

## Application initialization

The backend bucket name is not stored in the configuration because it must be
globally unique:

```bash
cd infra/app
terraform init -backend-config='bucket=GLOBALLY-UNIQUE-NAME'
```

Build the Lambda packages before running `terraform plan` or `terraform apply`:

```bash
nvm use 24
pnpm install
pnpm build
```

The `infra/app` configuration creates DynamoDB, KMS, SQS with a dead-letter
queue, Secrets Manager, Lambda functions, IAM roles, API Gateway, and the event
source mapping between SQS and the activity worker.

## GitHub Actions deployment

The [`github`](github/README.md) stack creates the restricted AWS IAM role used
by GitHub Actions through OIDC. Pushes to `main` build the application and
produce a Terraform plan. Pushing any tag repeats those checks and applies the
saved plan automatically.

## Application secret value

After Terraform creates the secret, set its value outside Terraform as the
following JSON object:

```json
{
  "discordBotToken": "...",
  "discordPublicKey": "...",
  "discordWebhookUrl": "...",
  "stravaClientId": "...",
  "stravaClientSecret": "...",
  "stravaWebhookVerifyToken": "..."
}
```

Do not store secret values in `.tfvars` files or Terraform state.
