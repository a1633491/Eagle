import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { marketOverview, tokenDetails } from './data/mockData.js';
import { getChainConfig, normalizeChainKey } from './chainConfig.js';
import {
  forceFactorySync,
  getFactorySyncStatus,
  getMarketOverview,
  getRuntimeDiagnostics,
  getTokenDetail,
  getTokenTrades,
  registerTokenLaunch,
  setWorkerStorageBindings,
  type RegisterTokenPayload,
} from './tokenRegistry.js';

type WorkerD1Statement = {
  bind(...values: unknown[]): WorkerD1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

type WorkerBindings = {
  TOKEN_IMAGE_BUCKET?: {
    put(
      key: string,
      value: Blob,
      options?: {
        httpMetadata?: {
          contentType?: string;
          cacheControl?: string;
        };
      },
    ): Promise<void>;
    get(key: string): Promise<{
      body: ReadableStream<Uint8Array> | null;
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
      size: number;
    } | null>;
  };
  TOKEN_STORAGE_KV?: {
    get(key: string, options?: { type?: 'text' | 'json' }): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  };
  TOKEN_STORAGE_DB?: {
    prepare(query: string): WorkerD1Statement;
  };
  WORKER_RUNTIME?: string;
  MONGODB_URI?: string;
  REDIS_URL?: string;
  BSC_RPC_URL?: string;
  BASE_RPC_URL?: string;
  EAGLE_FACTORY_ADDRESS?: string;
  BASE_FACTORY_ADDRESS?: string;
  EAGLE_FACTORY_START_BLOCK?: string;
  BASE_FACTORY_START_BLOCK?: string;
  EAGLE_SYNC_BLOCK_WINDOW?: string;
  EAGLE_SYNC_CHUNK_SIZE?: string;
  EAGLE_SYNC_MAX_CHUNKS_PER_RUN?: string;
  TOKEN_SYNC_COOLDOWN_MS?: string;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type ScheduledControllerLike = {
  cron: string;
  scheduledTime: number;
};

const app = new Hono<{ Bindings: WorkerBindings }>();

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data });
const fail = (msg: string, code = 400) => ({ code, msg, data: null });

function applyBindings(bindings: WorkerBindings) {
  process.env.WORKER_RUNTIME = 'cloudflare';
  setWorkerStorageBindings({
    TOKEN_STORAGE_KV: bindings.TOKEN_STORAGE_KV ?? null,
    TOKEN_STORAGE_DB: bindings.TOKEN_STORAGE_DB ?? null,
  });
  for (const [key, value] of Object.entries(bindings)) {
    if (key === 'WORKER_RUNTIME' || key === 'TOKEN_STORAGE_KV' || key === 'TOKEN_STORAGE_DB' || key === 'TOKEN_IMAGE_BUCKET') continue;
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    if (typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

function sanitizeImageExtension(type: string, fallbackName: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/gif') return 'gif';
  if (type === 'image/webp') return 'webp';
  const suffix = fallbackName.split('.').pop()?.toLowerCase();
  if (suffix && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(suffix)) {
    return suffix === 'jpeg' ? 'jpg' : suffix;
  }
  return 'bin';
}

app.use('*', cors());
app.use('*', async (c, next) => {
  applyBindings(c.env);
  await next();
});

app.get('/', (c) => {
  return c.json(ok({ service: 'eagle-server-worker', status: 'ok' }));
});

app.get('/api/health', (c) => {
  return c.json(ok({ status: 'ok', runtime: 'cloudflare-worker', diagnostics: getRuntimeDiagnostics() }));
});

app.get('/api/tokens', async (c) => {
  try {
    const chainKey = normalizeChainKey(c.req.query('chain'));
    const chain = getChainConfig(chainKey);
    const overview = await getMarketOverview({ ...marketOverview, chain: chain.name }, chainKey);
    return c.json(ok(overview));
  } catch (error) {
    const chainKey = normalizeChainKey(c.req.query('chain'));
    const chain = getChainConfig(chainKey);
    return c.json(
      ok({ ...marketOverview, chainKey, chainId: chain.chainId, chain: chain.name, launchedCount: 0, totalVolume24h: 0, trending: [], tokens: [] }),
      200,
    );
  }
});

app.get('/api/tokens/sync-status', async (c) => {
  try {
    const status = await getFactorySyncStatus(normalizeChainKey(c.req.query('chain')));
    return c.json(ok(status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get sync status';
    return c.json(fail(message, 500), 500);
  }
});

app.post('/api/tokens/sync', async (c) => {
  try {
    const chainKey = normalizeChainKey(c.req.query('chain'));
    const body = (await c.req.json<{ reset?: boolean }>().catch(() => ({} as { reset?: boolean }))) as {
      reset?: boolean;
    };
    const status = await forceFactorySync({ reset: Boolean(body.reset), chainKey });
    return c.json(ok(status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync factory launches';
    return c.json(fail(message, 500), 500);
  }
});

app.post('/api/tokens/register', async (c) => {
  const payload = await c.req.json<RegisterTokenPayload>();
  try {
    const token = await registerTokenLaunch(payload);
    return c.json(ok(token));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register token';
    return c.json(fail(message), 400);
  }
});

app.post('/api/uploads/token-image', async (c) => {
  try {
    const bucket = c.env.TOKEN_IMAGE_BUCKET;
    if (!bucket) {
      return c.json(fail('Token image bucket is not configured', 500), 500);
    }

    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return c.json(fail('Image file is required'));
    }

    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      return c.json(fail('Unsupported image format'));
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json(fail('Image size exceeds 5 MB'));
    }

    const extension = sanitizeImageExtension(file.type, file.name);
    const objectKey = `token-image-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await bucket.put(objectKey, file, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const imageUrl = `${new URL(c.req.url).origin}/api/images/${objectKey}`;
    return c.json(ok({ key: objectKey, imageUrl }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload token image';
    return c.json(fail(message, 500), 500);
  }
});

app.get('/api/images/:key', async (c) => {
  const bucket = c.env.TOKEN_IMAGE_BUCKET;
  if (!bucket) {
    return c.json(fail('Token image bucket is not configured', 500), 500);
  }

  const object = await bucket.get(c.req.param('key'));
  if (!object?.body) {
    return c.json(fail('Image not found', 404), 404);
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': object.httpMetadata?.cacheControl ?? 'public, max-age=31536000, immutable',
    },
  });
});

app.get('/api/tokens/:address', async (c) => {
  try {
    const chainKey = normalizeChainKey(c.req.query('chain'));
    const token = await getTokenDetail(c.req.param('address'), tokenDetails, chainKey);
    return c.json(ok(token));
  } catch {
    return c.json(fail('Token not found', 404), 404);
  }
});

app.get('/api/tokens/:address/trades', async (c) => {
  try {
    const chainKey = normalizeChainKey(c.req.query('chain'));
    const trades = await getTokenTrades(c.req.param('address'), tokenDetails, chainKey);
    return c.json(ok(trades));
  } catch {
    return c.json(fail('Token not found', 404), 404);
  }
});

app.post('/api/verify-token', (c) => {
  return c.json(fail('verify-token is not supported on Cloudflare Workers', 501), 501);
});

async function runScheduledSync(bindings: WorkerBindings) {
  applyBindings(bindings);
  await forceFactorySync({ chainKey: 'bsc' });
  await forceFactorySync({ chainKey: 'base' });
}

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledControllerLike, env: WorkerBindings, ctx: WorkerExecutionContext) {
    ctx.waitUntil(runScheduledSync(env));
  },
};
