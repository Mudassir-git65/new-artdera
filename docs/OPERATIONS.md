# Operations, deployment, and secret rotation

## Deployment shape

On Vercel, `npm run build` creates a TanStack Start/Nitro Build Output API bundle containing both SSR and the Express API. Vercel must use the **TanStack Start** framework preset with no `dist` Output Directory override. The Nitro Node entry connects MongoDB on cold start, reuses warm connections, and runs idempotent reservation/promotion maintenance opportunistically. Set `UPLOAD_PROVIDER=mongodb`; Vercel's local filesystem is temporary.

For a traditional Node host, build the API with `npm run build:api` and run it as a persistent process. At higher scale, move uploads to object storage and run maintenance as a single scheduled job or distributed-lock worker.

Set `APP_URL` to the canonical HTTPS frontend origin. Use `ALLOWED_ORIGINS` only for additional fixed origins; same-origin Vercel preview URLs work automatically. If frontend and API are split, set `VITE_API_URL` at frontend build time and configure the reverse proxy to preserve HTTPS/proxy headers. Do not use wildcard credentialed CORS.

MongoDB must support transactions. Atlas should use TLS, a database-specific user with least privilege, an IP/private-network allowlist, continuous backup, point-in-time recovery where available, and alerts for connection/operation anomalies.

## Secret rotation

1. Create a replacement credential at the provider; do not overwrite the only working credential first.
2. Update the deployment secret store, never Git or a Vite-prefixed variable.
3. restart/roll the API and verify `/api/health`, login, and `npm run db:smoke` where safe.
4. Revoke the old credential after the replacement is healthy.
5. For `AUTH_SECRET`, rotation invalidates any secret-derived material; schedule it as a session logout event and verify login afterward.
6. Review Git history and provider logs if a secret was exposed. Rotation, not merely deleting a file, is required.

The MongoDB URI, auth secret, provider API keys, webhook secrets, and object-storage credentials belong only in the deployment secret manager. `.env.example` documents names and safe examples; `.env*` secret variants are ignored.

## Backups and recovery

- Enable Atlas continuous backups or daily snapshots with retention appropriate to marketplace, invoice, and audit requirements.
- Test restoration into a separate restricted project at least quarterly.
- Keep object-storage versioning/lifecycle policies aligned with database retention.
- Document recovery time and recovery point objectives before accepting production orders.
- Never use demo seed/reset commands against production.

## External services and operational work still required for launch

- Configure both manual buyer-payment receiving accounts and establish proof review, refund, and reconciliation procedures.
- Configure an authorized subscription payment provider if paid seller-plan charging is enabled.
- Malware scanning and dedicated object storage when GridFS is no longer appropriate for upload volume.
- Courier booking/tracking webhooks.
- Tokenized bank payout/disbursement and reconciliation.
- Legal review of policies, retention, returns, tax, and dispute language.

`DEMO_PAYMENT_MODE`, local uploads, and demo fixture accounts are development facilities and must be disabled or replaced before production. MongoDB GridFS is the built-in persistent Vercel upload option. Manual JazzCash/Easypaisa order payments do not use `PAYMENT_PROVIDER`; they remain unapproved until an administrator verifies the submitted proof.
