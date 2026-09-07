import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { marketOverview, tokenDetails } from './data/mockData.js';
import {
  forceFactorySync,
  getFactorySyncStatus,
  getMarketOverview,
  getTokenDetail,
  getTokenTrades,
  registerTokenLaunch,
  type RegisterTokenPayload,
} from './tokenRegistry.js';

dotenv.config();

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
  response.json(ok({ status: 'ok' }));
});

app.get('/api/tokens', async (_request, response) => {
  try {
    const overview = await getMarketOverview(marketOverview);
    response.json(ok(overview));
  } catch {
    response.json(ok({ ...marketOverview, launchedCount: 0, totalVolume24h: 0, trending: [], tokens: [] }));
  }
});

app.get('/api/tokens/sync-status', async (_request, response) => {
  try {
    const status = await getFactorySyncStatus();
    response.json(ok(status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get sync status';
    response.status(500).json(fail(message, 500));
  }
});

app.post('/api/tokens/sync', async (request, response) => {
  try {
    const reset = Boolean((request.body as { reset?: boolean } | undefined)?.reset);
    const status = await forceFactorySync({ reset });
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
    const token = await getTokenDetail(request.params.address, tokenDetails);
    response.json(ok(token));
  } catch {
    response.status(404).json(fail('Token not found', 404));
  }
});

app.get('/api/tokens/:address/trades', async (request, response) => {
  try {
    const trades = await getTokenTrades(request.params.address, tokenDetails);
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
