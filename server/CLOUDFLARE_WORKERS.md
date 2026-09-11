# Cloudflare Workers Deployment

## Current scope

This project now has a Cloudflare Workers entrypoint in `src/worker.ts`.

The recommended storage backend is now **Cloudflare D1** for token records and sync state. KV can remain configured as a fallback during migration, but high-frequency writes should move to D1.

Supported routes:

- `GET /`
- `GET /api/health`
- `GET /api/tokens`
- `GET /api/tokens/sync-status`
- `POST /api/tokens/sync`
- `POST /api/tokens/register`
- `GET /api/tokens/:address`
- `GET /api/tokens/:address/trades`

Not supported on Workers:

- `POST /api/verify-token`

## Required secrets

Set these with `wrangler secret put`:

```bash
wrangler secret put MONGODB_URI
wrangler secret put BSC_RPC_URL
wrangler secret put EAGLE_FACTORY_ADDRESS
wrangler secret put EAGLE_FACTORY_START_BLOCK
wrangler secret put EAGLE_SYNC_CHUNK_SIZE
wrangler secret put EAGLE_SYNC_MAX_CHUNKS_PER_RUN
wrangler secret put TOKEN_SYNC_COOLDOWN_MS
```

Optional:

```bash
wrangler secret put REDIS_URL
wrangler secret put EAGLE_SYNC_BLOCK_WINDOW
```

## Recommended values

For RPC stability, start with:

```text
EAGLE_SYNC_CHUNK_SIZE=50
EAGLE_SYNC_MAX_CHUNKS_PER_RUN=50
TOKEN_SYNC_COOLDOWN_MS=30000
```

## Local development

```bash
npm run dev:worker
```

## D1 setup

1. Create the D1 database:

```bash
npx wrangler d1 create eagle-token-storage
```

2. Copy the returned `database_id` into the commented `d1_databases` block in `wrangler.jsonc`.

3. Apply the migration:

```bash
npx wrangler d1 migrations apply eagle-token-storage
```

The schema file lives at `migrations/0001_init_token_storage.sql`.

## Deploy

```bash
npm run deploy:worker
```

## Notes

- D1 is the primary Workers storage target for `tokens` and `sync_state`.
- Redis is intentionally disabled in the Workers runtime in the current implementation.
- MongoDB is still used, but the runtime uses smaller pool and timeout settings to reduce Workers-side connection pressure.
- If `GET /api/tokens/sync-status` stays at zeroes after deploy, trigger:

```bash
curl -X POST "https://<your-worker-domain>/api/tokens/sync" \
  -H "Content-Type: application/json" \
  -d '{"reset":true}'
```
