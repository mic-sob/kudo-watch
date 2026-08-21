# Infrastruktura KudoWatch

## Bootstrap stanu

Po utworzeniu konta AWS:

```bash
cd infra/bootstrap
terraform init
terraform apply -var='state_bucket_name=GLOBALNIE-UNIKALNA-NAZWA'
```

Bootstrap ma własny lokalny stan. Należy go zachować w bezpiecznym miejscu; bucket ma `prevent_destroy` i wersjonowanie.

## Inicjalizacja aplikacji

Bucket backendu nie jest zapisany w kodzie, ponieważ jego nazwa musi być globalnie unikalna:

```bash
cd infra/app
terraform init -backend-config='bucket=GLOBALNIE-UNIKALNA-NAZWA'
```

Przed `terraform plan` lub `terraform apply` należy zbudować paczki Lambda:

```bash
nvm use 24
pnpm install
pnpm build
```

Konfiguracja `infra/app` tworzy DynamoDB, KMS, SQS z DLQ, Secrets Manager, funkcje Lambda, role IAM, API Gateway oraz połączenie kolejki z workerem.

## Zawartość sekretu aplikacji

Po utworzeniu sekretu przez Terraform jego wartość należy ustawić poza Terraformem jako obiekt JSON:

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

Wartości sekretu nie należy zapisywać w plikach `.tfvars` ani w stanie Terraform.
