import mongoose, { Schema } from 'mongoose';
import { createClient, type RedisClientType } from 'redis';
import { createPublicClient, getAddress, http, isAddress, parseAbiItem } from 'viem';

const DEFAULT_FACTORY_ADDRESS = '0xEfca26BAc433975a27E894eeD196C8a1D32c4beE';
const DEFAULT_QUOTE_TOKEN_PRICE = 0.0000049;
const DEFAULT_SYNC_BLOCK_WINDOW = 20000n;
const DEFAULT_SYNC_CHUNK_SIZE = 2000n;
const DEFAULT_SYNC_MAX_CHUNKS_PER_RUN = 8;
const DEFAULT_SYNC_COOLDOWN_MS = 30_000;
const DEFAULT_CACHE_TTL_SECONDS = 30;
const FACTORY_SYNC_STATE_KEY = 'factory-launch-sync';
const WORKER_TOKENS_KV_KEY = 'tokens:all';
const WORKER_SYNC_STATE_KV_KEY = `sync:${FACTORY_SYNC_STATE_KEY}`;
const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event';
const DEBUG_SESSION_ID = 'token-list-missing';
const DEBUG_ENABLED = process.env.ENABLE_DEBUG_LOGS === '1';

const tokenLaunchedEvent = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed creator, address indexed quoteToken, address pool, uint24 fee, int24 initialTick, uint256 totalSupply, uint256[] lockedPositionIds, string name, string symbol, string metadataURI)',
);

type TokenTrade = {
  id: string;
  time: string;
  type: 'Buy' | 'Sell';
  amountToken: number;
  amountUsd: number;
  sender: string;
  priceUsd: number;
};

type ChartPoint = {
  time: number;
  value: number;
};

export type TokenRecord = {
  address: string;
  name: string;
  symbol: string;
  quoteToken: string;
  quoteSymbol: string;
  priceUsd: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  description: string;
  creator: string;
  poolAddress: string;
  official?: boolean;
  tags: string[];
  totalSupply: string;
  launchedDate: string;
  launchedAgo: string;
  pairLabel: string;
  chart: ChartPoint[];
  trades: TokenTrade[];
  metadataURI?: string;
  feeTier?: number;
  launchedAt: string;
};

export type MarketOverview = {
  chain: string;
  launchedCount: number;
  totalVolume24h: number;
  trending: TokenRecord[];
  tokens: TokenRecord[];
};

type FallbackToken = {
  address: string;
  name: string;
  symbol: string;
  quoteSymbol: string;
  priceUsd: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  launchedAgo: string;
  description: string;
  creator: string;
  poolAddress: string;
  official?: boolean;
  tags: string[];
  totalSupply: string;
  launchedDate: string;
  pairLabel: string;
  chart: ChartPoint[];
  trades: TokenTrade[];
};

type FallbackOverview = {
  chain: string;
  launchedCount: number;
  totalVolume24h: number;
  trending: FallbackToken[];
  tokens: FallbackToken[];
};

export type RegisterTokenPayload = {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  creator: string;
  poolAddress: string;
  quoteToken: string;
  quoteSymbol?: string;
  totalSupply: string;
  metadataURI?: string;
  feeTier?: number;
  launchedAt?: string;
};

type StoredTokenDocument = {
  address: string;
  name: string;
  symbol: string;
  quoteToken: string;
  quoteSymbol: string;
  priceUsd: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  description: string;
  creator: string;
  poolAddress: string;
  official: boolean;
  tags: string[];
  totalSupply: string;
  launchedAt: Date;
  metadataURI?: string;
  feeTier?: number;
  chart: ChartPoint[];
  trades: TokenTrade[];
  updatedAt: Date;
};

export type SyncStatus = {
  key: string;
  syncStartedFrom: string;
  lastSyncedBlock: string;
  latestKnownBlock: string;
  lastSyncStatus: 'idle' | 'syncing' | 'done' | 'error';
  lastSyncError: string;
  updatedAt: string;
};

export type RuntimeDiagnostics = {
  runtime: 'node' | 'cloudflare-worker';
  hasMongoUri: boolean;
  hasRedisUrl: boolean;
  hasRpcUrl: boolean;
  hasWorkerKv: boolean;
  mongoReadyState: number;
  inMemoryTokenCount: number;
  hasInMemorySyncState: boolean;
  lastFactorySyncAt: number;
  storageBackend: 'memory' | 'mongo' | 'worker-kv';
};

type StoredSyncStateDocument = {
  key: string;
  syncStartedFrom: string;
  lastSyncedBlock: string;
  latestKnownBlock: string;
  lastSyncStatus: 'idle' | 'syncing' | 'done' | 'error';
  lastSyncError: string;
  updatedAt: Date;
};

type WorkerKvStore = {
  get(key: string, options?: { type?: 'text' | 'json' }): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
};

type SerializedStoredToken = Omit<StoredTokenDocument, 'launchedAt' | 'updatedAt'> & {
  launchedAt: string;
  updatedAt: string;
};

type SerializedStoredSyncState = Omit<StoredSyncStateDocument, 'updatedAt'> & {
  updatedAt: string;
};

const chartPointSchema = new Schema<ChartPoint>(
  {
    time: { type: Number, required: true },
    value: { type: Number, required: true },
  },
  { _id: false },
);

const tokenTradeSchema = new Schema<TokenTrade>(
  {
    id: { type: String, required: true },
    time: { type: String, required: true },
    type: { type: String, enum: ['Buy', 'Sell'], required: true },
    amountToken: { type: Number, required: true },
    amountUsd: { type: Number, required: true },
    sender: { type: String, required: true },
    priceUsd: { type: Number, required: true },
  },
  { _id: false },
);

const storedTokenSchema = new Schema<StoredTokenDocument>(
  {
    address: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    quoteToken: { type: String, required: true },
    quoteSymbol: { type: String, required: true },
    priceUsd: { type: Number, required: true, default: DEFAULT_QUOTE_TOKEN_PRICE },
    change24h: { type: Number, required: true, default: 0 },
    marketCap: { type: Number, required: true, default: 0 },
    volume24h: { type: Number, required: true, default: 0 },
    liquidity: { type: Number, required: true, default: 0 },
    holders: { type: Number, required: true, default: 0 },
    description: { type: String, required: true, default: '' },
    creator: { type: String, required: true },
    poolAddress: { type: String, required: true },
    official: { type: Boolean, required: true, default: false },
    tags: { type: [String], required: true, default: ['New'] },
    totalSupply: { type: String, required: true },
    launchedAt: { type: Date, required: true, index: true },
    metadataURI: { type: String },
    feeTier: { type: Number },
    chart: { type: [chartPointSchema], required: true, default: [] },
    trades: { type: [tokenTradeSchema], required: true, default: [] },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    versionKey: false,
  },
);

const StoredTokenModel =
  (mongoose.models.StoredToken as mongoose.Model<StoredTokenDocument> | undefined) ??
  mongoose.model<StoredTokenDocument>('StoredToken', storedTokenSchema);

const storedSyncStateSchema = new Schema<StoredSyncStateDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    syncStartedFrom: { type: String, required: true, default: '0' },
    lastSyncedBlock: { type: String, required: true, default: '0' },
    latestKnownBlock: { type: String, required: true, default: '0' },
    lastSyncStatus: { type: String, enum: ['idle', 'syncing', 'done', 'error'], required: true, default: 'idle' },
    lastSyncError: { type: String, required: true, default: '' },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    versionKey: false,
  },
);

const StoredSyncStateModel =
  (mongoose.models.StoredSyncState as mongoose.Model<StoredSyncStateDocument> | undefined) ??
  mongoose.model<StoredSyncStateDocument>('StoredSyncState', storedSyncStateSchema);

const inMemoryTokens = new Map<string, StoredTokenDocument>();
let inMemorySyncState: StoredSyncStateDocument | null = null;

let mongoConnectPromise: Promise<typeof mongoose> | null = null;
let redisClientPromise: Promise<RedisClientType | null> | null = null;
let lastFactorySyncAt = 0;
let syncInFlight: Promise<void> | null = null;
let workerKvStore: WorkerKvStore | null = null;

function isWorkerRuntime() {
  return process.env.WORKER_RUNTIME === 'cloudflare';
}

function getWorkerKvStore() {
  return isWorkerRuntime() ? workerKvStore : null;
}

function serializeStoredToken(document: StoredTokenDocument): SerializedStoredToken {
  return {
    ...document,
    launchedAt: document.launchedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function deserializeStoredToken(document: SerializedStoredToken): StoredTokenDocument {
  return {
    ...document,
    launchedAt: new Date(document.launchedAt),
    updatedAt: new Date(document.updatedAt),
  };
}

function serializeStoredSyncState(document: StoredSyncStateDocument): SerializedStoredSyncState {
  return {
    ...document,
    updatedAt: document.updatedAt.toISOString(),
  };
}

function deserializeStoredSyncState(document: SerializedStoredSyncState): StoredSyncStateDocument {
  return {
    ...document,
    updatedAt: new Date(document.updatedAt),
  };
}

async function readWorkerStoredTokens() {
  const kv = getWorkerKvStore();
  if (!kv) return null;
  const payload = (await kv.get(WORKER_TOKENS_KV_KEY, {
    type: 'json',
  })) as SerializedStoredToken[] | null;
  return (payload ?? []).map(deserializeStoredToken);
}

async function writeWorkerStoredTokens(tokens: StoredTokenDocument[]) {
  const kv = getWorkerKvStore();
  if (!kv) return false;
  await kv.put(
    WORKER_TOKENS_KV_KEY,
    JSON.stringify(tokens.map(serializeStoredToken)),
  );
  return true;
}

async function readWorkerSyncState() {
  const kv = getWorkerKvStore();
  if (!kv) return null;
  const payload = (await kv.get(WORKER_SYNC_STATE_KV_KEY, {
    type: 'json',
  })) as SerializedStoredSyncState | null;
  return payload ? deserializeStoredSyncState(payload) : null;
}

async function writeWorkerSyncState(document: StoredSyncStateDocument) {
  const kv = getWorkerKvStore();
  if (!kv) return false;
  await kv.put(WORKER_SYNC_STATE_KV_KEY, JSON.stringify(serializeStoredSyncState(document)));
  return true;
}

function emitDebug(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
  if (!DEBUG_ENABLED) return;
  fetch(DEBUG_SERVER_URL, {
    method: 'POST',
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

function envNumber(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBigInt(name: string, fallback: bigint) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function quoteSymbolFromAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c') return 'WBNB';
  if (normalized === '0x55d398326f99059ff775485246999027b3197955') return 'USDT';
  return 'TOKEN';
}

function normalizeAddress(address: string) {
  return getAddress(address);
}

function compactAmount(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 2 : 0,
  }).format(value);
}

function formatLaunchedAgo(launchedAt: Date) {
  const diffMs = Math.max(Date.now() - launchedAt.getTime(), 0);
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day ago`;
}

function formatLaunchedDate(launchedAt: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(launchedAt);
}

function buildChart(priceUsd: number, launchedAt: Date): ChartPoint[] {
  const safePrice = priceUsd > 0 ? priceUsd : DEFAULT_QUOTE_TOKEN_PRICE;
  const points: ChartPoint[] = [];
  const start = Math.floor(launchedAt.getTime() / 1000) - 19 * 3600;
  for (let index = 0; index < 20; index += 1) {
    const offset = index - 9;
    const multiplier = 1 + offset * 0.012;
    points.push({
      time: start + index * 3600,
      value: Number((safePrice * Math.max(multiplier, 0.25)).toFixed(10)),
    });
  }
  return points;
}

function toNumericSupply(totalSupply: string) {
  const normalized = totalSupply.trim();
  if (!/^\d+$/.test(normalized)) return 0;
  const integer = normalized.slice(0, Math.max(normalized.length - 18, 0)) || '0';
  const parsed = Number(integer);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTotalSupplyLabel(totalSupply: string, symbol: string) {
  const amount = toNumericSupply(totalSupply);
  return `${compactAmount(amount)} ${symbol}`;
}

function toTokenRecord(document: StoredTokenDocument): TokenRecord {
  return {
    address: document.address,
    name: document.name,
    symbol: document.symbol,
    quoteToken: document.quoteToken,
    quoteSymbol: document.quoteSymbol,
    priceUsd: document.priceUsd,
    change24h: document.change24h,
    marketCap: document.marketCap,
    volume24h: document.volume24h,
    liquidity: document.liquidity,
    holders: document.holders,
    description: document.description,
    creator: document.creator,
    poolAddress: document.poolAddress,
    official: document.official,
    tags: document.tags,
    totalSupply: buildTotalSupplyLabel(document.totalSupply, document.symbol),
    launchedDate: formatLaunchedDate(document.launchedAt),
    launchedAgo: formatLaunchedAgo(document.launchedAt),
    pairLabel: `${document.symbol} / ${document.quoteSymbol}`,
    chart: document.chart.length ? document.chart : buildChart(document.priceUsd, document.launchedAt),
    trades: document.trades,
    metadataURI: document.metadataURI,
    feeTier: document.feeTier,
    launchedAt: document.launchedAt.toISOString(),
  };
}

function buildOverview(tokens: TokenRecord[], fallback: FallbackOverview) {
  const sortedTokens = [...tokens].sort((left, right) => {
    return new Date(right.launchedAt).getTime() - new Date(left.launchedAt).getTime();
  });
  const trending = [...sortedTokens]
    .sort((left, right) => right.volume24h + right.marketCap - (left.volume24h + left.marketCap))
    .slice(0, Math.min(sortedTokens.length, 3));
  return {
    chain: fallback.chain,
    launchedCount: sortedTokens.length,
    totalVolume24h: sortedTokens.reduce((sum, token) => sum + token.volume24h, 0),
    trending,
    tokens: sortedTokens,
  };
}

function toSyncStatus(document: StoredSyncStateDocument): SyncStatus {
  return {
    key: document.key,
    syncStartedFrom: document.syncStartedFrom,
    lastSyncedBlock: document.lastSyncedBlock,
    latestKnownBlock: document.latestKnownBlock,
    lastSyncStatus: document.lastSyncStatus,
    lastSyncError: document.lastSyncError,
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function getRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (isWorkerRuntime()) return null;
  if (!redisUrl) return null;
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({ url: redisUrl });
      client.on('error', () => {});
      await client.connect();
      return client;
    })().catch(() => null);
  }
  return redisClientPromise;
}

async function getMongoConnection() {
  const mongoUri = process.env.MONGODB_URI?.trim();
  // #region debug-point C:mongo-connect-attempt
  emitDebug('C', 'server/src/tokenRegistry.ts:getMongoConnection:attempt', '[DEBUG] Mongo connection requested', {
    hasMongoUri: Boolean(mongoUri),
    readyState: mongoose.connection.readyState,
    workerRuntime: isWorkerRuntime(),
  });
  // #endregion
  if (!mongoUri) return null;
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!mongoConnectPromise) {
    mongoConnectPromise = mongoose.connect(
      mongoUri,
      isWorkerRuntime()
        ? {
            maxPoolSize: 1,
            minPoolSize: 0,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            retryWrites: false,
          }
        : undefined,
    );
  }
  return mongoConnectPromise.catch((error) => {
    // #region debug-point C:mongo-connect-error
    emitDebug('C', 'server/src/tokenRegistry.ts:getMongoConnection:error', '[DEBUG] Mongo connection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    // #endregion
    return null;
  });
}

async function readStoredTokens() {
  const workerTokens = await readWorkerStoredTokens();
  if (workerTokens) {
    return workerTokens.sort((left, right) => right.launchedAt.getTime() - left.launchedAt.getTime());
  }

  const connection = await getMongoConnection();
  if (connection) {
    const rows = await StoredTokenModel.find().sort({ launchedAt: -1 }).lean();
    // #region debug-point C:read-stored-tokens-mongo
    emitDebug('C', 'server/src/tokenRegistry.ts:readStoredTokens:mongo', '[DEBUG] Read stored tokens from MongoDB', {
      count: rows.length,
    });
    // #endregion
    return rows.map((row) => ({
      ...row,
      launchedAt: new Date(row.launchedAt),
      updatedAt: new Date(row.updatedAt),
    })) as StoredTokenDocument[];
  }
  // #region debug-point E:read-stored-tokens-memory
  emitDebug('E', 'server/src/tokenRegistry.ts:readStoredTokens:memory', '[DEBUG] Read stored tokens from in-memory fallback', {
    count: inMemoryTokens.size,
  });
  // #endregion
  return [...inMemoryTokens.values()].sort((left, right) => right.launchedAt.getTime() - left.launchedAt.getTime());
}

async function writeStoredToken(document: StoredTokenDocument) {
  const workerTokens = await readWorkerStoredTokens();
  if (workerTokens) {
    const nextTokens = workerTokens.filter((entry) => entry.address !== document.address);
    nextTokens.push(document);
    await writeWorkerStoredTokens(nextTokens);
  } else {
  const connection = await getMongoConnection();
  if (connection) {
    // #region debug-point C:write-stored-token-mongo
    emitDebug('C', 'server/src/tokenRegistry.ts:writeStoredToken:mongo', '[DEBUG] Writing token to MongoDB', {
      address: document.address,
      symbol: document.symbol,
    });
    // #endregion
    await StoredTokenModel.findOneAndUpdate(
      { address: document.address },
      { ...document, updatedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } else {
    // #region debug-point E:write-stored-token-memory
    emitDebug('E', 'server/src/tokenRegistry.ts:writeStoredToken:memory', '[DEBUG] Writing token to in-memory fallback', {
      address: document.address,
      symbol: document.symbol,
    });
    // #endregion
    inMemoryTokens.set(document.address.toLowerCase(), document);
  }
  }

  const redis = await getRedisClient();
  if (redis) {
    await Promise.allSettled([
      redis.del('eagle:market-overview'),
      redis.del(`eagle:token:${document.address.toLowerCase()}`),
    ]);
  }
}

async function readStoredToken(address: string) {
  const normalized = address.toLowerCase();
  const workerTokens = await readWorkerStoredTokens();
  if (workerTokens) {
    return workerTokens.find((entry) => entry.address === normalized) ?? null;
  }

  const connection = await getMongoConnection();
  if (connection) {
    const row = await StoredTokenModel.findOne({ address: normalized }).lean();
    if (!row) return null;
    return {
      ...row,
      launchedAt: new Date(row.launchedAt),
      updatedAt: new Date(row.updatedAt),
    } as StoredTokenDocument;
  }
  return inMemoryTokens.get(normalized) ?? null;
}

async function readSyncState() {
  const workerState = await readWorkerSyncState();
  if (workerState) {
    return workerState;
  }

  const connection = await getMongoConnection();
  if (connection) {
    const row = await StoredSyncStateModel.findOne({ key: FACTORY_SYNC_STATE_KEY }).lean();
    if (!row) return null;
    return {
      ...row,
      updatedAt: new Date(row.updatedAt),
    } as StoredSyncStateDocument;
  }
  return inMemorySyncState;
}

async function writeSyncState(update: Partial<StoredSyncStateDocument> & { key?: string }) {
  const nextState: StoredSyncStateDocument = {
    key: update.key ?? FACTORY_SYNC_STATE_KEY,
    syncStartedFrom: update.syncStartedFrom ?? '0',
    lastSyncedBlock: update.lastSyncedBlock ?? '0',
    latestKnownBlock: update.latestKnownBlock ?? '0',
    lastSyncStatus: update.lastSyncStatus ?? 'idle',
    lastSyncError: update.lastSyncError ?? '',
    updatedAt: update.updatedAt ?? new Date(),
  };

  if (await writeWorkerSyncState(nextState)) {
    return;
  }

  const connection = await getMongoConnection();
  if (connection) {
    await StoredSyncStateModel.findOneAndUpdate(
      { key: nextState.key },
      nextState,
      { upsert: true, setDefaultsOnInsert: true },
    );
  } else {
    inMemorySyncState = nextState;
  }
}

async function resetSyncState(startBlock: bigint) {
  await writeSyncState({
    key: FACTORY_SYNC_STATE_KEY,
    syncStartedFrom: startBlock.toString(),
    lastSyncedBlock: (startBlock > 0n ? startBlock - 1n : 0n).toString(),
    latestKnownBlock: '0',
    lastSyncStatus: 'idle',
    lastSyncError: '',
    updatedAt: new Date(),
  });
}

async function fetchDexScreenerSnapshot(tokenAddress: string) {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      pairs?: Array<{
        chainId?: string;
        pairAddress?: string;
        dexId?: string;
        priceUsd?: string;
        volume?: { h24?: number };
        liquidity?: { usd?: number };
        fdv?: number;
        marketCap?: number;
        priceChange?: { h24?: number };
        quoteToken?: { symbol?: string; address?: string };
      }>;
    };

    const pairs = (payload.pairs ?? []).filter((pair) => pair.chainId === 'bsc');
    if (!pairs.length) return null;
    const bestPair = [...pairs].sort(
      (left, right) => Number(right.liquidity?.usd ?? 0) - Number(left.liquidity?.usd ?? 0),
    )[0];
    return {
      quoteSymbol: bestPair.quoteToken?.symbol,
      quoteToken: bestPair.quoteToken?.address,
      poolAddress: bestPair.pairAddress,
      priceUsd: Number(bestPair.priceUsd ?? 0),
      change24h: Number(bestPair.priceChange?.h24 ?? 0),
      volume24h: Number(bestPair.volume?.h24 ?? 0),
      liquidity: Number(bestPair.liquidity?.usd ?? 0),
      marketCap: Number(bestPair.marketCap ?? bestPair.fdv ?? 0),
    };
  } catch {
    return null;
  }
}

function validateRegisterPayload(payload: RegisterTokenPayload) {
  if (!isAddress(payload.address)) return 'Invalid token address';
  if (!isAddress(payload.creator)) return 'Invalid creator address';
  if (!isAddress(payload.poolAddress)) return 'Invalid pool address';
  if (!isAddress(payload.quoteToken)) return 'Invalid quote token address';
  if (!payload.name.trim()) return 'Token name is required';
  if (!payload.symbol.trim()) return 'Token symbol is required';
  if (!/^\d+$/.test(payload.totalSupply.trim())) return 'Total supply must be an integer string';
  return null;
}

async function makeStoredToken(payload: RegisterTokenPayload): Promise<StoredTokenDocument> {
  const launchedAt = payload.launchedAt ? new Date(payload.launchedAt) : new Date();
  const normalizedAddress = normalizeAddress(payload.address);
  const normalizedCreator = normalizeAddress(payload.creator);
  const normalizedPool = normalizeAddress(payload.poolAddress);
  const normalizedQuote = normalizeAddress(payload.quoteToken);
  const dexSnapshot = await fetchDexScreenerSnapshot(normalizedAddress);
  const numericSupply = toNumericSupply(payload.totalSupply);
  const fallbackPrice = dexSnapshot?.priceUsd && dexSnapshot.priceUsd > 0 ? dexSnapshot.priceUsd : DEFAULT_QUOTE_TOKEN_PRICE;
  const marketCap = dexSnapshot?.marketCap && dexSnapshot.marketCap > 0 ? dexSnapshot.marketCap : numericSupply * fallbackPrice;
  const quoteSymbol = payload.quoteSymbol?.trim() || dexSnapshot?.quoteSymbol || quoteSymbolFromAddress(normalizedQuote);

  return {
    address: normalizedAddress.toLowerCase(),
    name: payload.name.trim(),
    symbol: payload.symbol.trim(),
    quoteToken: normalizedQuote.toLowerCase(),
    quoteSymbol,
    priceUsd: fallbackPrice,
    change24h: dexSnapshot?.change24h ?? 0,
    marketCap,
    volume24h: dexSnapshot?.volume24h ?? 0,
    liquidity: dexSnapshot?.liquidity ?? 0,
    holders: 0,
    description: payload.description?.trim() ?? '',
    creator: normalizedCreator.toLowerCase(),
    poolAddress: (dexSnapshot?.poolAddress && isAddress(dexSnapshot.poolAddress) ? normalizeAddress(dexSnapshot.poolAddress) : normalizedPool).toLowerCase(),
    official: false,
    tags: ['New'],
    totalSupply: payload.totalSupply.trim(),
    launchedAt,
    metadataURI: payload.metadataURI?.trim(),
    feeTier: payload.feeTier,
    chart: buildChart(fallbackPrice, launchedAt),
    trades: [],
    updatedAt: new Date(),
  };
}

function resolvedFactoryStartBlock(latestBlock: bigint) {
  const blockWindow = envBigInt('EAGLE_SYNC_BLOCK_WINDOW', DEFAULT_SYNC_BLOCK_WINDOW);
  const startBlockEnv = process.env.EAGLE_FACTORY_START_BLOCK?.trim();
  if (startBlockEnv) {
    try {
      return BigInt(startBlockEnv);
    } catch {
      return latestBlock > blockWindow ? latestBlock - blockWindow : 0n;
    }
  }
  return latestBlock > blockWindow ? latestBlock - blockWindow : 0n;
}

async function syncFactoryLaunchesInternal(options?: { force?: boolean; reset?: boolean }) {
  const rpcUrl = process.env.BSC_RPC_URL?.trim();
  // #region debug-point D:sync-start
  emitDebug('D', 'server/src/tokenRegistry.ts:syncFactoryLaunchesInternal:start', '[DEBUG] Factory sync invoked', {
    hasRpcUrl: Boolean(rpcUrl),
    force: Boolean(options?.force),
    reset: Boolean(options?.reset),
  });
  // #endregion
  if (!rpcUrl) return;

  const now = Date.now();
  if (!options?.force && now - lastFactorySyncAt < envNumber('TOKEN_SYNC_COOLDOWN_MS', DEFAULT_SYNC_COOLDOWN_MS)) {
    return;
  }
  lastFactorySyncAt = now;

  const client = createPublicClient({ transport: http(rpcUrl) });
  const latestBlock = await client.getBlockNumber();
  const startBlock = resolvedFactoryStartBlock(latestBlock);
  const chunkSize = envBigInt('EAGLE_SYNC_CHUNK_SIZE', DEFAULT_SYNC_CHUNK_SIZE);
  const maxChunksPerRun = envNumber('EAGLE_SYNC_MAX_CHUNKS_PER_RUN', DEFAULT_SYNC_MAX_CHUNKS_PER_RUN);
  const factoryAddress = normalizeAddress(process.env.EAGLE_FACTORY_ADDRESS?.trim() || DEFAULT_FACTORY_ADDRESS);
  // #region debug-point D:sync-config
  emitDebug('D', 'server/src/tokenRegistry.ts:syncFactoryLaunchesInternal:config', '[DEBUG] Factory sync config resolved', {
    latestBlock: latestBlock.toString(),
    startBlock: startBlock.toString(),
    chunkSize: chunkSize.toString(),
    maxChunksPerRun,
    factoryAddress,
    workerRuntime: isWorkerRuntime(),
  });
  // #endregion

  const existingState = options?.reset ? null : await readSyncState();
  if (options?.reset || (existingState && BigInt(existingState.syncStartedFrom) > startBlock)) {
    await resetSyncState(startBlock);
  }

  const syncState = (options?.reset ? null : existingState) ?? (await readSyncState());
  let nextFromBlock = syncState ? BigInt(syncState.lastSyncedBlock) + 1n : startBlock;
  if (nextFromBlock < startBlock) {
    nextFromBlock = startBlock;
  }

  await writeSyncState({
    key: FACTORY_SYNC_STATE_KEY,
    syncStartedFrom: startBlock.toString(),
    lastSyncedBlock: syncState?.lastSyncedBlock ?? (startBlock > 0n ? (startBlock - 1n).toString() : '0'),
    latestKnownBlock: latestBlock.toString(),
    lastSyncStatus: nextFromBlock > latestBlock ? 'done' : 'syncing',
    lastSyncError: '',
    updatedAt: new Date(),
  });

  if (nextFromBlock > latestBlock) {
    return;
  }

  try {
    let processedChunks = 0;
    let cursor = nextFromBlock;

    while (cursor <= latestBlock && processedChunks < maxChunksPerRun) {
      const toBlock = cursor + chunkSize - 1n < latestBlock ? cursor + chunkSize - 1n : latestBlock;
      const logs = await client.getLogs({
        address: factoryAddress,
        event: tokenLaunchedEvent,
        fromBlock: cursor,
        toBlock,
      });
      // #region debug-point D:sync-chunk
      emitDebug('D', 'server/src/tokenRegistry.ts:syncFactoryLaunchesInternal:chunk', '[DEBUG] Factory sync chunk scanned', {
        fromBlock: cursor.toString(),
        toBlock: toBlock.toString(),
        logCount: logs.length,
        processedChunks,
      });
      // #endregion

      for (const log of logs) {
        const args = log.args;
        if (!args.token || !args.creator || !args.quoteToken || !args.pool || !args.name || !args.symbol || args.totalSupply === undefined) {
          continue;
        }
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        await registerTokenLaunch({
          address: args.token,
          creator: args.creator,
          poolAddress: args.pool,
          quoteToken: args.quoteToken,
          quoteSymbol: quoteSymbolFromAddress(args.quoteToken),
          name: args.name,
          symbol: args.symbol,
          totalSupply: args.totalSupply.toString(),
          metadataURI: args.metadataURI,
          feeTier: Number(args.fee),
          launchedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
        });
        // #region debug-point D:sync-register-token
        emitDebug('D', 'server/src/tokenRegistry.ts:syncFactoryLaunchesInternal:register', '[DEBUG] Factory sync registered token from log', {
          token: args.token,
          symbol: args.symbol,
          blockNumber: log.blockNumber?.toString?.() ?? null,
        });
        // #endregion
      }

      await writeSyncState({
        key: FACTORY_SYNC_STATE_KEY,
        syncStartedFrom: startBlock.toString(),
        lastSyncedBlock: toBlock.toString(),
        latestKnownBlock: latestBlock.toString(),
        lastSyncStatus: toBlock >= latestBlock ? 'done' : 'syncing',
        lastSyncError: '',
        updatedAt: new Date(),
      });

      cursor = toBlock + 1n;
      processedChunks += 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // #region debug-point D:sync-error
    emitDebug('D', 'server/src/tokenRegistry.ts:syncFactoryLaunchesInternal:error', '[DEBUG] Factory sync failed', {
      error: message,
    });
    // #endregion
    await writeSyncState({
      key: FACTORY_SYNC_STATE_KEY,
      syncStartedFrom: startBlock.toString(),
      lastSyncedBlock: (nextFromBlock > startBlock ? nextFromBlock - 1n : startBlock > 0n ? startBlock - 1n : 0n).toString(),
      latestKnownBlock: latestBlock.toString(),
      lastSyncStatus: 'error',
      lastSyncError: message,
      updatedAt: new Date(),
    });
    throw error;
  }
}

export async function syncFactoryLaunches(options?: { force?: boolean; reset?: boolean }) {
  if (!syncInFlight) {
    syncInFlight = syncFactoryLaunchesInternal(options).finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

export async function getFactorySyncStatus() {
  const state = await readSyncState();
  if (!state) {
    return {
      key: FACTORY_SYNC_STATE_KEY,
      syncStartedFrom: '0',
      lastSyncedBlock: '0',
      latestKnownBlock: '0',
      lastSyncStatus: 'idle',
      lastSyncError: '',
      updatedAt: new Date(0).toISOString(),
    } satisfies SyncStatus;
  }
  return toSyncStatus(state);
}

export async function forceFactorySync(options?: { reset?: boolean }) {
  await syncFactoryLaunches({ force: true, reset: options?.reset });
  return getFactorySyncStatus();
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const storageBackend: RuntimeDiagnostics['storageBackend'] = getWorkerKvStore()
    ? 'worker-kv'
    : process.env.MONGODB_URI?.trim()
      ? 'mongo'
      : 'memory';
  return {
    runtime: isWorkerRuntime() ? 'cloudflare-worker' : 'node',
    hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
    hasRedisUrl: Boolean(process.env.REDIS_URL?.trim()),
    hasRpcUrl: Boolean(process.env.BSC_RPC_URL?.trim()),
    hasWorkerKv: Boolean(getWorkerKvStore()),
    mongoReadyState: mongoose.connection.readyState,
    inMemoryTokenCount: inMemoryTokens.size,
    hasInMemorySyncState: Boolean(inMemorySyncState),
    lastFactorySyncAt,
    storageBackend,
  };
}

export function setWorkerStorageBindings(bindings: { TOKEN_STORAGE_KV?: WorkerKvStore | null }) {
  workerKvStore = bindings.TOKEN_STORAGE_KV ?? null;
}

export async function registerTokenLaunch(payload: RegisterTokenPayload) {
  const validationError = validateRegisterPayload(payload);
  if (validationError) {
    throw new Error(validationError);
  }
  const document = await makeStoredToken(payload);
  await writeStoredToken(document);
  return toTokenRecord(document);
}

export async function getMarketOverview(fallback: FallbackOverview) {
  if (!isWorkerRuntime()) {
    await Promise.allSettled([syncFactoryLaunches()]);
  }

  const redis = await getRedisClient();
  if (redis) {
    const cached = await redis.get('eagle:market-overview');
    if (cached) {
      return JSON.parse(cached) as MarketOverview;
    }
  }

  const stored = await readStoredTokens();
  const overview = buildOverview(stored.map(toTokenRecord), fallback);
  // #region debug-point B:get-market-overview-result
  emitDebug('B', 'server/src/tokenRegistry.ts:getMarketOverview:result', '[DEBUG] Market overview built', {
    storedCount: stored.length,
    launchedCount: overview.launchedCount,
    trendingCount: overview.trending.length,
  });
  // #endregion

  if (redis) {
    await redis.set('eagle:market-overview', JSON.stringify(overview), {
      EX: DEFAULT_CACHE_TTL_SECONDS,
    });
  }
  return overview;
}

export async function getTokenDetail(address: string, _fallbackTokens: FallbackToken[]) {
  if (!isAddress(address)) {
    throw new Error('Invalid token address');
  }

  if (!isWorkerRuntime()) {
    await Promise.allSettled([syncFactoryLaunches()]);
  }

  const redis = await getRedisClient();
  const cacheKey = `eagle:token:${address.toLowerCase()}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TokenRecord;
    }
  }

  const stored = await readStoredToken(address);
  if (!stored) {
    throw new Error('Token not found');
  }
  const token = toTokenRecord(stored);

  if (redis && token) {
    await redis.set(cacheKey, JSON.stringify(token), {
      EX: DEFAULT_CACHE_TTL_SECONDS,
    });
  }

  return token;
}

export async function getTokenTrades(address: string, fallbackTokens: FallbackToken[]) {
  const token = await getTokenDetail(address, fallbackTokens);
  return token.trades;
}
