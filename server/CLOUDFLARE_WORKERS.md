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
- `POST /api/swap/quote`
- `POST /api/swap/check-approval`
- `POST /api/swap/build`
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
wrangler secret put BASE_RPC_URL
wrangler secret put BASE_FACTORY_ADDRESS
wrangler secret put BASE_FACTORY_START_BLOCK
wrangler secret put ROBINHOOD_RPC_URL
wrangler secret put ROBINHOOD_FACTORY_ADDRESS
wrangler secret put ROBINHOOD_FACTORY_START_BLOCK
wrangler secret put ROBINHOOD_WETH_ADDRESS
wrangler secret put ROBINHOOD_STABLE_TOKEN_ADDRESS
wrangler secret put ROBINHOOD_STABLE_SYMBOL
wrangler secret put ARC_RPC_URL
wrangler secret put ARC_FACTORY_ADDRESS
wrangler secret put ARC_FACTORY_START_BLOCK
wrangler secret put ARC_WRAPPED_NATIVE_TOKEN_ADDRESS
wrangler secret put ARC_STABLE_TOKEN_ADDRESS
wrangler secret put ARC_STABLE_SYMBOL
wrangler secret put EAGLE_SYNC_CHUNK_SIZE
wrangler secret put EAGLE_SYNC_MAX_CHUNKS_PER_RUN
wrangler secret put TOKEN_SYNC_COOLDOWN_MS
wrangler secret put UNISWAP_API_KEY
```

Optional:

```bash
wrangler secret put REDIS_URL
wrangler secret put EAGLE_SYNC_BLOCK_WINDOW
wrangler secret put UNISWAP_QUOTE_URL
```

## Recommended values

For RPC stability, start with:

```text
EAGLE_SYNC_CHUNK_SIZE=50
EAGLE_SYNC_MAX_CHUNKS_PER_RUN=50
TOKEN_SYNC_COOLDOWN_MS=30000
```

Per-chain defaults:

```text
BSC_RPC_URL=https://bsc-dataseed.bnbchain.org
EAGLE_FACTORY_ADDRESS=0xEfca26BAc433975a27E894eeD196C8a1D32c4beE

BASE_RPC_URL=https://mainnet.base.org
BASE_FACTORY_ADDRESS=0xEfca26BAc433975a27E894eeD196C8a1D32c4beE

ROBINHOOD_RPC_URL=https://robinhood.drpc.org
ROBINHOOD_FACTORY_ADDRESS=0x3A4CE33bb65b9429465b6EAda2F29C9f7bF0a122
ROBINHOOD_FACTORY_START_BLOCK=61971645
ROBINHOOD_WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
ROBINHOOD_STABLE_TOKEN_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
ROBINHOOD_STABLE_SYMBOL=USDG

ARC_RPC_URL=https://rpc.mainnet.arc.io
ARC_FACTORY_ADDRESS=0xEfca26BAc433975a27E894eeD196C8a1D32c4beE
ARC_FACTORY_START_BLOCK=21177224
ARC_WRAPPED_NATIVE_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000
ARC_STABLE_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000
ARC_STABLE_SYMBOL=USDC
UNISWAP_ROUTER_VERSION=2.2.0
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

The schema files live at:

- `migrations/0001_init_token_storage.sql`
- `migrations/0002_add_multichain_support.sql`

## Deploy

```bash
npm run deploy:worker
```

## Notes

- D1 is the primary Workers storage target for `tokens` and `sync_state`.
- `GET /api/tokens`, `GET /api/tokens/:address`, `GET /api/tokens/sync-status`, and `POST /api/tokens/sync` accept `?chain=bsc|base|robinhood|arc`.
- BSC and Base use the shared Brew deployment trio `0xEfca... / 0x01ec... / 0x5BD1...`; Robinhood uses the Uni v3-backed Brew deployment `0x3A4C... / 0x7DF4... / 0x834B...`.
- Arc is wired for the same Uni v3-style Brew launch flow as Robinhood. The current Arc factory trio is `0xEfca... / 0x01ec... / 0x5BD1...`, deployed from block `21177224`.
- `POST /api/swap/quote`, `POST /api/swap/check-approval`, and `POST /api/swap/build` are swap helper routes. Robinhood now uses the Brew launch flow plus Uni v3 market infrastructure.
- Redis is intentionally disabled in the Workers runtime in the current implementation.
- MongoDB is still used, but the runtime uses smaller pool and timeout settings to reduce Workers-side connection pressure.
- If `GET /api/tokens/sync-status` stays at zeroes after deploy, trigger:

```bash
curl -X POST "https://<your-worker-domain>/api/tokens/sync" \
  -H "Content-Type: application/json" \
  -d '{"reset":true}'
```
