CREATE TABLE IF NOT EXISTS tokens (
  address TEXT PRIMARY KEY,
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
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_launched_at ON tokens(launched_at DESC);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  sync_started_from TEXT NOT NULL,
  last_synced_block TEXT NOT NULL,
  latest_known_block TEXT NOT NULL,
  last_sync_status TEXT NOT NULL,
  last_sync_error TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
