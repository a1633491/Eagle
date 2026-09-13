import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { getChainConfig, normalizeChainKey } from './chainConfig.js';
import { marketOverview, tokenDetails } from './data/mockData.js';
import {
  forceFactorySync,
  getFactorySyncStatus,
  getMarketOverview,
  getRuntimeDiagnostics,
  getTokenDetail,
  getTokenTrades,
  registerTokenLaunch,
  type RegisterTokenPayload,
} from './tokenRegistry.js';

dotenv.config();

const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event';
const DEBUG_SESSION_ID = 'token-list-missing';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const isVercelRuntime = process.env.VERCEL === '1';

app.use(cors());
app.use(express.json());

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data });
const fail = (msg: string, code = 400) => ({ code, msg, data: null });

app.get('/', (_request, response) => {
  response.json(ok({ service: 'eagle-server', status: 'ok' }));
});

app.get('/api/health', (_request, response) => {
  response.json(ok({ status: 'ok', runtime: getRuntimeDiagnostics() }));
});

app.get('/api/tokens', async (_request, response) => {
  // #region debug-point B:api-tokens-enter
  fetch(DEBUG_SERVER_URL, {
    method: 'POST',
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'server/src/index.ts:/api/tokens:enter',
      msg: '[DEBUG] /api/tokens entered',
      data: { isVercelRuntime, port },
      ts: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  try {
    const chainKey = normalizeChainKey(String(_request.query.chain ?? ''));
    const chain = getChainConfig(chainKey);
    const overview = await getMarketOverview({ ...marketOverview, chain: chain.name }, chainKey);
    // #region debug-point B:api-tokens-success
    fetch(DEBUG_SERVER_URL, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: 'pre-fix',
        hypothesisId: 'B',
        location: 'server/src/index.ts:/api/tokens:success',
        msg: '[DEBUG] /api/tokens success',
        data: {
          launchedCount: overview.launchedCount,
          tokenCount: overview.tokens.length,
          trendingCount: overview.trending.length,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    response.json(ok(overview));
  } catch (error) {
    const chainKey = normalizeChainKey(String(_request.query.chain ?? ''));
    const chain = getChainConfig(chainKey);
    const message = error instanceof Error ? error.message : 'unknown';
    // #region debug-point B:api-tokens-error
    fetch(DEBUG_SERVER_URL, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: 'pre-fix',
        hypothesisId: 'B',
        location: 'server/src/index.ts:/api/tokens:error',
        msg: '[DEBUG] /api/tokens failed and fell back',
        data: { error: message },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    response.json(ok({ ...marketOverview, chainKey, chainId: chain.chainId, chain: chain.name, launchedCount: 0, totalVolume24h: 0, trending: [], tokens: [] }));
  }
});

app.get('/api/tokens/sync-status', async (request, response) => {
  try {
    const status = await getFactorySyncStatus(normalizeChainKey(String(request.query.chain ?? '')));
    response.json(ok(status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get sync status';
    response.status(500).json(fail(message, 500));
  }
});

app.post('/api/tokens/sync', async (request, response) => {
  try {
    const reset = Boolean((request.body as { reset?: boolean } | undefined)?.reset);
    const chainKey = normalizeChainKey(String(request.query.chain ?? ''));
    const status = await forceFactorySync({ reset, chainKey });
    response.json(ok(status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync factory launches';
    response.status(500).json(fail(message, 500));
  }
});

app.post('/api/tokens/register', async (request, response) => {
  const payload = request.body as RegisterTokenPayload;

  try {
    const token = await registerTokenLaunch(payload);
    response.json(ok(token));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register token';
    response.status(400).json(fail(message));
  }
});

app.get('/api/tokens/:address', async (request, response) => {
  try {
    const token = await getTokenDetail(request.params.address, tokenDetails, normalizeChainKey(String(request.query.chain ?? '')));
    response.json(ok(token));
  } catch {
    response.status(404).json(fail('Token not found', 404));
  }
});

app.get('/api/tokens/:address/trades', async (request, response) => {
  try {
    const trades = await getTokenTrades(request.params.address, tokenDetails, normalizeChainKey(String(request.query.chain ?? '')));
    response.json(ok(trades));
  } catch {
    response.status(404).json(fail('Token not found', 404));
  }
});

app.post('/api/verify-token', async (request, response) => {
  if (isVercelRuntime) {
    response.status(501).json(fail('verify-token is not supported on Vercel runtime', 501));
    return;
  }

  const verificationModule = await import('./verification.js');
  const payload = request.body as import('./verification.js').VerifyTokenRequest;
  const validationError = verificationModule.validateVerifyTokenRequest(payload);

  if (validationError) {
    response.status(400).json(fail(validationError));
    return;
  }

  try {
    verificationModule.queueTokenVerification(payload);
    response.json(ok({ status: 'queued', address: payload.address }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue verification';
    response.status(500).json(fail(message, 500));
  }
});

if (!isVercelRuntime) {
  app.listen(port, () => {
    console.log(`server running on http://localhost:${port}`);
  });
}

export default app;
