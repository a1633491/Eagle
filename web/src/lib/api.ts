import { ApiResponse, MarketOverview, TokenDetail } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

const emptyOverview: MarketOverview = {
  chain: 'BNB Chain',
  launchedCount: 0,
  totalVolume24h: 0,
  trending: [],
  tokens: [],
};

function emptyTokenDetail(address: string): TokenDetail {
  return {
    address,
    name: 'Unknown Token',
    symbol: 'UNKNOWN',
    quoteSymbol: 'WBNB',
    priceUsd: 0,
    change24h: 0,
    marketCap: 0,
    volume24h: 0,
    liquidity: 0,
    holders: 0,
    launchedAgo: 'just now',
    description: '',
    creator: '0x0000000000000000000000000000000000000000',
    poolAddress: '0x0000000000000000000000000000000000000000',
    tags: [],
    totalSupply: '0 UNKNOWN',
    launchedDate: '',
    pairLabel: 'UNKNOWN / WBNB',
    chart: [],
    trades: [],
  };
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(1500),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${path}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

export function getMarketOverview(): Promise<MarketOverview> {
  return request<MarketOverview>('/tokens').catch(() => emptyOverview);
}

export function getTokenDetail(address: string): Promise<TokenDetail> {
  return request<TokenDetail>(`/tokens/${address}`).catch(() => emptyTokenDetail(address));
}
