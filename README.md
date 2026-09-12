# ArtDera Global Canvas

ArtDera is a full-stack marketplace for buyers, artists, galleries, gallery staff, and marketplace administrators. The existing TanStack Router/React/Vite interface is backed by an Express API, Mongoose models, and MongoDB. Authentication and business data are server-owned; the browser does not store session tokens or marketplace records.

## Architecture

- `src/`: the existing React interface, route tree, typed API services, and UI state.
- `server/index.ts`: API process and background marketplace maintenance.
- `server/app.ts`: Express middleware, security headers, rate limits, and route registration.
- `server/db.ts`: cached Mongoose connection.
- `server/models/index.ts`: marketplace schemas and indexes.
- `server/routes/`: auth, plans, stores, artwork, commerce, operations, gallery, and admin APIs.
- `server/services/`: centralized plan enforcement, audit, notification, provider adapters, reservation expiry, and sponsored-placement lifecycle.
- `nitro/`: Vercel's serverless bridge that serves the Express API from the same deployment as the TanStack application.
- `tests/`: Vitest/Supertest integration suite using an in-memory MongoDB replica set.

The frontend uses `src/marketplace/services.ts` as its API boundary. Separate local web/API servers use the `API_PROXY_TARGET` environment variable. Production should keep `VITE_API_URL` unset for the combined same-origin deployment, or set it only to the HTTPS origin of a separately hosted API.

## Local setup

Requirements: Node.js 22, npm, and a MongoDB Atlas cluster or MongoDB replica set (transactions are used for checkout and paid subscription activation).

```bash
npm install
copy .env.example .env
npm run seed
npm run dev
```

Keep `.env` server-side and untracked. The API validates required configuration at startup and fails without exposing credentials.

Important environment variables:

| Variable                         | Purpose                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `MONGODB_URI`                    | Rotated MongoDB connection string; never expose through Vite variables.              |
| `MONGODB_DB_NAME`                | Database name, normally `artdera`.                                                   |
| `AUTH_SECRET`                    | Strong random application secret (minimum 32 characters).                            |
| `APP_URL`                        | Exact browser origin allowed to send credentialed requests.                          |
| `ALLOWED_ORIGINS`                | Optional comma-separated additional browser origins.                                 |
| `API_PORT`                       | Express port, normally `3001`.                                                       |
| `NODE_ENV`                       | `development`, `test`, or `production`.                                              |
| `DEMO_PAYMENT_MODE`              | Enables server-only development payment confirmation. Must be `false` in production. |
| `PAYMENT_PROVIDER`               | Subscription payment adapter; buyer orders use manual JazzCash/Easypaisa proof.      |
| `UPLOAD_PROVIDER` / `UPLOAD_DIR` | `local` for development or persistent `mongodb` GridFS storage on Vercel.            |
| `SEED_DEMO_DATA`                 | Explicitly enables development fixtures during `npm run seed`.                       |

Hosted deployments must use `NODE_ENV=production`. The production build command pins this value as a defense in depth measure so React SSR cannot accidentally be compiled with its development-only `jsxDEV` transform.

See [.env.example](./.env.example) for the safe template. Demo account emails/passwords must be provided through local environment variables and are bcrypt-hashed before insertion. The seed command refuses demo fixtures in production and never creates a known production admin password.

## Commands

```bash
npm run dev            # API and Vite application
npm run dev:api        # API only
npm run dev:web        # frontend only
npm run seed           # idempotent plans, taxonomy, shipping rule, and optional fixtures
npm run db:smoke       # Atlas connection plus create/read/update/delete verification
npm run admin:create   # interactive/environment-driven admin creation
npm test               # backend integration suite
npm run typecheck      # frontend and backend TypeScript
npm run lint           # ESLint
npm run build          # production frontend bundle
npm run build:api      # compiled API output
```

## Authentication and security

Passwords use bcrypt with work factor 12. Login creates a cryptographically random opaque session token; only its SHA-256 hash is stored in MongoDB. The raw token is sent in an `httpOnly`, `sameSite=lax` cookie and is `secure` in production. Email delivery, email verification, and password recovery are temporarily disabled.

Express uses Helmet, an exact credentialed CORS allowlist, origin checks on mutations, JSON size limits, payload operator guards, module-specific rate limiting, Zod validation, safe response serializers, and a consistent error envelope. Object ownership, role access, gallery staff permissions, plan permissions, listing quotas, totals, transitions, reviews, and payment activation are enforced on the API.

Uploads are streamed through Multer, checked by size, extension, MIME type, and file signature, then stored through an adapter. Verification documents are private. Vercel deployments use MongoDB GridFS rather than the function's temporary filesystem.

No card number, CVV, wallet PIN, online-banking password, raw OTP, raw session token, or plaintext password is accepted or persisted.

## Provider adapters

- Buyer payments: checkout displays the configured JazzCash/Easypaisa receiving account, accepts a private payment screenshot and transaction ID, and keeps the order pending until an administrator approves it. No wallet PIN, OTP, or password is collected.
- Subscription payments: the demo adapter creates and verifies provider references. Replace `server/services/payments.ts` with an authorized provider implementation before charging paid seller plans automatically.
- Uploads: `server/routes/uploads.ts` supports local development storage and persistent MongoDB GridFS storage with authorized private reads.
- Shipping and payouts: calculations and records are persisted, but courier booking and bank disbursement remain intentionally disabled until authorized providers are configured.

## Production checklist

- Disable demo payment mode.
- Do not seed demo accounts.
- Use HTTPS and secure cookies.
- Restrict Atlas network access and give the database user only the required database permissions.
- Rotate MongoDB, auth, storage, and payment secrets before launch.
- Set `UPLOAD_PROVIDER=mongodb` on Vercel, or replace it with a reviewed private object-storage provider at higher scale.
- Configure and test the two manual receiving accounts, subscription billing (if paid plans are enabled), courier, and payout providers.
- Back up MongoDB with Atlas continuous backup or scheduled snapshots; test restores regularly.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run build:api` in CI.

Detailed route contracts are in [docs/API.md](./docs/API.md), and deployment/rotation guidance is in [docs/OPERATIONS.md](./docs/OPERATIONS.md).

## Vercel deployment

The repository pins the Vercel framework to TanStack Start, Node 22, and a Nitro Node entry. The production build emits the complete Build Output API bundle under `.vercel/output`; do not configure `dist` as the Vercel Output Directory.

In Vercel Project Settings, select **TanStack Start** and turn off the Output Directory override (leave it empty/automatic). Add the required server variables from `.env.example` to Production and Preview, using `APP_URL=https://www.artdera.com` and `UPLOAD_PROVIDER=mongodb`. Vercel deployments force production mode and safely disable demo payment and seed modes even if development values were copied accidentally. Keep `VITE_API_URL` unset for this combined deployment so the browser calls the same-origin `/api` routes.
