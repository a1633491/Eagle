import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { launch } from '@cloudflare/playwright';
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
  BROWSER?: unknown;
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
  ROBINHOOD_RPC_URL?: string;
  EAGLE_FACTORY_ADDRESS?: string;
  BASE_FACTORY_ADDRESS?: string;
  ROBINHOOD_FACTORY_ADDRESS?: string;
  EAGLE_FACTORY_START_BLOCK?: string;
  BASE_FACTORY_START_BLOCK?: string;
  ROBINHOOD_FACTORY_START_BLOCK?: string;
  ROBINHOOD_WETH_ADDRESS?: string;
  ROBINHOOD_STABLE_SYMBOL?: string;
  ROBINHOOD_STABLE_TOKEN_ADDRESS?: string;
  ROBINHOODSCAN_API_KEY?: string;
  UNISWAP_API_KEY?: string;
  UNISWAP_QUOTE_URL?: string;
  UNISWAP_ROUTER_VERSION?: string;
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

type SwapQuoteRequest = {
  chainKey?: string;
  swapper?: string;
  tokenIn?: string;
  tokenOut?: string;
  amount?: string;
  slippageTolerance?: number;
};

type SwapBuildRequest = {
  quote?: Record<string, unknown>;
};

type VerifyTokenRequest = {
  chainKey?: string;
  address?: string;
  name?: string;
  symbol?: string;
  totalSupply?: string;
  factoryAddress?: string;
  metadataURI?: string;
  creator?: string;
};

const BREW_LAUNCH_SUITE_SOURCE_URL =
  'https://raw.githubusercontent.com/a1633491/Eagle/main/contracts-recovered/contracts/BrewLaunchSuite.sol';

function getUniswapHeaders(bindings: WorkerBindings) {
  return {
    'x-api-key': bindings.UNISWAP_API_KEY?.trim() ?? '',
    'x-universal-router-version': bindings.UNISWAP_ROUTER_VERSION?.trim() || '2.2.0',
    'x-permit2-disabled': 'true',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function forwardUniswapRequest(
  bindings: WorkerBindings,
  endpoint: 'quote' | 'check_approval' | 'swap',
  body: Record<string, unknown>,
) {
  const apiKey = bindings.UNISWAP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Uniswap API key is not configured');
  }

  const response = await fetch(`${bindings.UNISWAP_QUOTE_URL?.trim()?.replace(/\/quote$/, '') || 'https://trade-api.gateway.uniswap.org/v1'}/${endpoint}`, {
    method: 'POST',
    headers: getUniswapHeaders(bindings),
    body: JSON.stringify(body),
  });

  const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message =
      (typeof result?.detail === 'string' && result.detail) ||
      (typeof result?.errorCode === 'string' && result.errorCode) ||
      `Failed to ${endpoint.replace('_', ' ')}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return result;
}

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

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function inferVerifyChainKey(payload: VerifyTokenRequest, bindings: WorkerBindings) {
  const requested = typeof payload.chainKey === 'string' ? normalizeChainKey(payload.chainKey) : undefined;
  if (requested) return requested;

  const factoryAddress = payload.factoryAddress?.toLowerCase();
  if (!factoryAddress) return undefined;
  if (bindings.ROBINHOOD_FACTORY_ADDRESS?.toLowerCase() === factoryAddress) return 'robinhood';
  if (bindings.BASE_FACTORY_ADDRESS?.toLowerCase() === factoryAddress) return 'base';
  if (bindings.EAGLE_FACTORY_ADDRESS?.toLowerCase() === factoryAddress) return 'bsc';
  return undefined;
}

function encodeUint256Hex(value: bigint) {
  return value.toString(16).padStart(64, '0');
}

function encodeAddressHex(value: string) {
  return value.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function encodeDynamicBytesHex(value: Uint8Array) {
  const lengthHex = encodeUint256Hex(BigInt(value.length));
  const bodyHex = Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const padding = (64 - (bodyHex.length % 64)) % 64;
  return `${lengthHex}${bodyHex}${'0'.repeat(padding)}`;
}

function utf8Hex(value: string) {
  return new TextEncoder().encode(value);
}

function encodeEagleTokenConstructorArguments(args: {
  name: string;
  symbol: string;
  totalSupply: bigint;
  factoryAddress: string;
  metadataURI: string;
  creator: string;
}) {
  const headSize = 6 * 32;
  const nameTail = encodeDynamicBytesHex(utf8Hex(args.name));
  const symbolTail = encodeDynamicBytesHex(utf8Hex(args.symbol));
  const metadataTail = encodeDynamicBytesHex(utf8Hex(args.metadataURI));

  const nameOffset = headSize;
  const symbolOffset = nameOffset + nameTail.length / 2;
  const metadataOffset = symbolOffset + symbolTail.length / 2;

  return [
    encodeUint256Hex(BigInt(nameOffset)),
    encodeUint256Hex(BigInt(symbolOffset)),
    encodeUint256Hex(args.totalSupply),
    encodeAddressHex(args.factoryAddress),
    encodeUint256Hex(BigInt(metadataOffset)),
    encodeAddressHex(args.creator),
    nameTail,
    symbolTail,
    metadataTail,
  ].join('');
}

async function buildEagleTokenStandardJsonInput() {
  const sourceResponse = await fetch(BREW_LAUNCH_SUITE_SOURCE_URL);
  if (!sourceResponse.ok) {
    throw new Error(`Failed to load BrewLaunchSuite source (${sourceResponse.status})`);
  }

  const source = await sourceResponse.text();
  return JSON.stringify({
    language: 'Solidity',
    sources: {
      'contracts/BrewLaunchSuite.sol': {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      viaIR: true,
      evmVersion: 'paris',
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.methodIdentifiers', 'metadata'],
          '': ['ast'],
        },
      },
    },
  });
}

async function fillFirstMatchingInput(page: any, selectors: string[], value: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }
    try {
      await locator.fill(value, { timeout: 2_000 });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function selectFirstMatchingValue(page: any, selectors: string[], value: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }
    try {
      await locator.selectOption({ value }, { timeout: 2_000 });
      return true;
    } catch {
      try {
        await locator.selectOption({ label: value }, { timeout: 2_000 });
        return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

async function submitRobinhoodTokenVerification(bindings: WorkerBindings, payload: Required<VerifyTokenRequest>) {
  if (!bindings.BROWSER) {
    throw new Error('Cloudflare Browser binding is not configured');
  }

  const standardJsonInput = await buildEagleTokenStandardJsonInput();
  const constructorArguments = encodeEagleTokenConstructorArguments({
    name: payload.name,
    symbol: payload.symbol,
    totalSupply: BigInt(payload.totalSupply),
    factoryAddress: payload.factoryAddress,
    metadataURI: payload.metadataURI,
    creator: payload.creator,
  });
  const browser = await launch(bindings.BROWSER as never);

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30_000);
    const verificationUrl = `https://robinhoodchain.blockscout.com/address/${payload.address}/contract-verification?type=solidity-standard-json-input`;

    await page.goto(verificationUrl, { waitUntil: 'domcontentloaded' });

    const consentButton = page.getByRole('button', { name: /accept/i }).first();
    if ((await consentButton.count()) > 0) {
      try {
        await consentButton.click({ timeout: 2_000 });
      } catch {
        // Ignore cookie overlays when they are not actionable.
      }
    }

    const fileInput = page.locator('input[type="file"][name="sources"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
    await fileInput.setInputFiles({
      name: 'eagletoken-robinhood-standard-input.json',
      mimeType: 'application/json',
      buffer: Buffer.from(standardJsonInput, 'utf8'),
    });

    await fillFirstMatchingInput(
      page,
      [
        'textarea[name="constructor_arguments"]',
        'textarea[name="constructorArguments"]',
        'input[name="constructor_arguments"]',
        'input[name="constructorArguments"]',
        'textarea[placeholder*="constructor" i]',
        'input[placeholder*="constructor" i]',
      ],
      constructorArguments,
    );

    await fillFirstMatchingInput(
      page,
      [
        'input[name="contract_name"]',
        'input[name="contractName"]',
        'input[placeholder*="contract name" i]',
      ],
      'contracts/BrewLaunchSuite.sol:EagleToken',
    );

    await selectFirstMatchingValue(
      page,
      ['select[name="compiler_version"]', 'select[name="compilerVersion"]'],
      'v0.8.24+commit.e11b9ed9',
    );

    const responsePromise = page.waitForResponse(
      (response: { request(): { method(): string }; url(): string }) =>
        response.request().method() === 'POST' &&
        response.url().includes('/verification/via/standard-input'),
      { timeout: 45_000 },
    );

    const verifyButton = page.getByRole('button', { name: /verify\s*&\s*publish/i }).first();
    await verifyButton.click();

    const response = await responsePromise;
    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(`Explorer rejected browser verification (${response.status}): ${bodyText.slice(0, 500)}`);
    }

    const parsed = JSON.parse(bodyText) as { message?: string; errors?: unknown; status?: string; guid?: string };
    const message = typeof parsed.message === 'string' ? parsed.message : 'Verification submitted';
    if (/already verified/i.test(message)) {
      return { status: 'already_verified', message };
    }

    return {
      status: parsed.status || 'submitted',
      guid: typeof parsed.guid === 'string' ? parsed.guid : '',
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Browser verification failed';
    throw new Error(message);
  } finally {
    await browser.close();
  }
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

app.post('/api/swap/quote', async (c) => {
  try {
    const payload = await c.req.json<SwapQuoteRequest>();
    const chainKey = normalizeChainKey(payload.chainKey);
    if (chainKey !== 'robinhood') {
      return c.json(fail('Legacy Robinhood swap quotes are only enabled on Robinhood chain'));
    }

    if (!payload.swapper || !payload.tokenIn || !payload.tokenOut || !payload.amount) {
      return c.json(fail('Missing swap quote fields'));
    }

    const chain = getChainConfig(chainKey);
    const result = await forwardUniswapRequest(c.env, 'quote', {
      type: 'EXACT_INPUT',
      tokenIn: payload.tokenIn,
      tokenOut: payload.tokenOut,
      tokenInChainId: chain.chainId,
      tokenOutChainId: chain.chainId,
      amount: payload.amount,
      swapper: payload.swapper,
      slippageTolerance: payload.slippageTolerance ?? 0.5,
      protocols: ['V4'],
    });
    return c.json(ok(result));
  } catch (error) {
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Failed to fetch swap quote';
    return c.json(fail(message, status), status as 400 | 404 | 429 | 500 | 501);
  }
});

app.post('/api/swap/check-approval', async (c) => {
  try {
    const payload = await c.req.json<SwapQuoteRequest>();
    const chainKey = normalizeChainKey(payload.chainKey);
    if (chainKey !== 'robinhood') {
      return c.json(fail('Legacy Robinhood swap approvals are only enabled on Robinhood chain'));
    }

    if (!payload.swapper || !payload.tokenIn || !payload.amount) {
      return c.json(fail('Missing approval fields'));
    }

    const chain = getChainConfig(chainKey);
    const result = await forwardUniswapRequest(c.env, 'check_approval', {
      walletAddress: payload.swapper,
      token: payload.tokenIn,
      amount: payload.amount,
      chainId: chain.chainId,
      tokenOut: payload.tokenOut,
      tokenOutChainId: chain.chainId,
      includeGasInfo: true,
    });
    return c.json(ok(result));
  } catch (error) {
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Failed to check swap approval';
    return c.json(fail(message, status), status as 400 | 404 | 429 | 500 | 501);
  }
});

app.post('/api/swap/build', async (c) => {
  try {
    const payload = await c.req.json<SwapBuildRequest>();
    if (!payload.quote) {
      return c.json(fail('Missing quote payload'));
    }

    const result = await forwardUniswapRequest(c.env, 'swap', {
      quote: payload.quote,
      refreshGasPrice: true,
      simulateTransaction: true,
    });
    return c.json(ok(result));
  } catch (error) {
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Failed to build swap transaction';
    return c.json(fail(message, status), status as 400 | 404 | 429 | 500 | 501);
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

app.post('/api/verify-token', async (c) => {
  try {
    const payload = (await c.req.json<VerifyTokenRequest>().catch(() => ({}))) as VerifyTokenRequest;
    const chainKey = inferVerifyChainKey(payload, c.env);

    if (chainKey !== 'robinhood') {
      return c.json(fail('verify-token currently supports Robinhood only on Cloudflare Workers', 501), 501);
    }

    if (
      !isAddress(payload.address) ||
      !isAddress(payload.factoryAddress) ||
      !isAddress(payload.creator) ||
      typeof payload.name !== 'string' ||
      !payload.name.trim() ||
      typeof payload.symbol !== 'string' ||
      !payload.symbol.trim() ||
      typeof payload.metadataURI !== 'string' ||
      !payload.metadataURI.trim() ||
      typeof payload.totalSupply !== 'string' ||
      !/^\d+$/.test(payload.totalSupply.trim())
    ) {
      return c.json(fail('Invalid verification payload'), 400);
    }

    const jobPayload = {
      chainKey,
      address: payload.address,
      name: payload.name.trim(),
      symbol: payload.symbol.trim(),
      totalSupply: payload.totalSupply.trim(),
      factoryAddress: payload.factoryAddress,
      metadataURI: payload.metadataURI.trim(),
      creator: payload.creator,
    };

    c.executionCtx.waitUntil(submitRobinhoodTokenVerification(c.env, jobPayload).catch((error) => console.error('Robinhood verify-token failed', error)));

    return c.json(ok({ chainKey, status: 'queued' }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit verification';
    return c.json(fail(message, 500), 500);
  }
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
