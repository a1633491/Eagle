# Cloudflare Workers Deployment

## Current scope

This project now has a Cloudflare Workers entrypoint in `src/worker.ts`.

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

## Deploy

```bash
npm run deploy:worker
```

## Notes

- Redis is intentionally disabled in the Workers runtime in the current implementation.
- MongoDB is still used, but the runtime uses smaller pool and timeout settings to reduce Workers-side connection pressure.
- If `GET /api/tokens/sync-status` stays at zeroes after deploy, trigger:

```bash
curl -X POST "https://<your-worker-domain>/api/tokens/sync" \
  -H "Content-Type: application/json" \
  -d '{"reset":true}'
```
