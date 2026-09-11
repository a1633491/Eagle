PRAGMA foreign_keys=off;

ALTER TABLE tokens RENAME TO tokens_old;

CREATE TABLE tokens (
  chain_key TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  quote_token TEXT NOT NULL,
  quote_symbol TEXT NOT NULL,
  price_usd REAL NOT NULL,
  change_24h REAL NOT NULL,
  market_cap REAL NOT NULL,
  volume_24h REAL NOT NULL,
  liquidity REAL NOT NULL,
  holders INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  creator TEXT NOT NULL,
  pool_address TEXT NOT NULL,
  official INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL,
  total_supply TEXT NOT NULL,
  launched_at TEXT NOT NULL,
  metadata_uri TEXT,
  fee_tier INTEGER,
  chart_json TEXT NOT NULL,
  trades_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (chain_key, address)
);

INSERT INTO tokens (
  chain_key,
  chain_id,
  address,
  name,
  symbol,
  quote_token,
  quote_symbol,
  price_usd,
  change_24h,
  market_cap,
  volume_24h,
  liquidity,
  holders,
  description,
  creator,
  pool_address,
  official,
  tags_json,
  total_supply,
  launched_at,
  metadata_uri,
  fee_tier,
  chart_json,
  trades_json,
  updated_at
)
SELECT
  'bsc',
  56,
  address,
  name,
  symbol,
  quote_token,
  quote_symbol,
  price_usd,
  change_24h,
  market_cap,
  volume_24h,
  liquidity,
  holders,
  description,
  creator,
  pool_address,
  official,
  tags_json,
  total_supply,
  launched_at,
  metadata_uri,
  fee_tier,
  chart_json,
  trades_json,
  updated_at
FROM tokens_old;

DROP TABLE tokens_old;

CREATE INDEX idx_tokens_chain_launched_at ON tokens(chain_key, launched_at DESC);

ALTER TABLE sync_state RENAME TO sync_state_old;

CREATE TABLE sync_state (
  key TEXT PRIMARY KEY,
  chain_key TEXT NOT NULL,
  sync_started_from TEXT NOT NULL,
  last_synced_block TEXT NOT NULL,
  latest_known_block TEXT NOT NULL,
  last_sync_status TEXT NOT NULL,
  last_sync_error TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

INSERT INTO sync_state (
  key,
  chain_key,
  sync_started_from,
  last_synced_block,
  latest_known_block,
  last_sync_status,
  last_sync_error,
  updated_at
)
SELECT
  key,
  'bsc',
  sync_started_from,
  last_synced_block,
  latest_known_block,
  last_sync_status,
  last_sync_error,
  updated_at
FROM sync_state_old;

DROP TABLE sync_state_old;

PRAGMA foreign_keys=on;
