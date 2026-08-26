# GitHub Actions infrastructure

This Terraform stack creates the IAM role assumed by the KudoWatch deployment
workflow. It uses the existing GitHub Actions OIDC provider and stores its own
state separately from both the bootstrap and application states.

The role trusts GitHub's immutable OIDC subject for this repository:
`repo:mic-sob@8579445/kudo-watch@1341738037:environment:production`. GitHub
uses owner and repository IDs in the default subject for repositories created
after July 15, 2026.

Initialize and apply the stack once using local AWS credentials:

```bash
terraform -chdir=infra/github init \
  -backend-config='bucket=kudowatch-terraform-state-628270103507'
terraform -chdir=infra/github plan -out=kudowatch-github.tfplan
terraform -chdir=infra/github apply kudowatch-github.tfplan
```

Create the `production` environment under **GitHub repository settings →
Environments**, then add these environment variables:

| Variable | Value |
| --- | --- |
| `AWS_ROLE_ARN` | Value of the `github_actions_role_arn` Terraform output |
| `TF_STATE_BUCKET` | `kudowatch-terraform-state-628270103507` |
| `DISCORD_GUILD_ID` | `1391100532155744266` |

Do not configure required reviewers if tagged releases should deploy
automatically. Configure deployment branch and tag rules so that `main` and
tags are allowed to use the environment.
