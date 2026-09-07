import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { marketOverview, tokenDetails } from './data/mockData.js';
import { getMarketOverview, getTokenDetail, getTokenTrades, registerTokenLaunch, type RegisterTokenPayload } from './tokenRegistry.js';
import { queueTokenVerification, type VerifyTokenRequest, validateVerifyTokenRequest } from './verification.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data });
const fail = (msg: string, code = 400) => ({ code, msg, data: null });

app.get('/api/health', (_request, response) => {
  response.json(ok({ status: 'ok' }));
});

app.get('/api/tokens', async (_request, response) => {
  try {
    const overview = await getMarketOverview(marketOverview);
    response.json(ok(overview));
  } catch {
    response.json(ok(marketOverview));
  }
});

app.get('/api/tokens/:address', async (request, response) => {
  try {
    const token = await getTokenDetail(request.params.address, tokenDetails);
    response.json(ok(token));
  } catch {
    const fallback = tokenDetails.find((item) => item.address === request.params.address) ?? tokenDetails[0];
    response.json(ok(fallback));
  }
});

app.get('/api/tokens/:address/trades', async (request, response) => {
  try {
    const trades = await getTokenTrades(request.params.address, tokenDetails);
    response.json(ok(trades));
  } catch {
    const fallback = tokenDetails.find((item) => item.address === request.params.address) ?? tokenDetails[0];
    response.json(ok(fallback.trades));
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

app.post('/api/verify-token', (request, response) => {
  const payload = request.body as VerifyTokenRequest;
  const validationError = validateVerifyTokenRequest(payload);

  if (validationError) {
    response.status(400).json(fail(validationError));
    return;
  }

  try {
    queueTokenVerification(payload);
    response.json(ok({ status: 'queued', address: payload.address }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue verification';
    response.status(500).json(fail(message, 500));
  }
});

app.listen(port, () => {
  console.log(`server running on http://localhost:${port}`);
});
