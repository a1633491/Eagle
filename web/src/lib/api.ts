import { ApiResponse, MarketOverview, TokenDetail } from '@/lib/types';
import { getChainConfig, normalizeChainKey, type ChainKey } from '@/lib/chains';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

function emptyOverview(chainKey: ChainKey): MarketOverview {
  const config = getChainConfig(chainKey);
  return {
    chainKey,
    chainId: config.chainId,
    chain: config.name,
    launchedCount: 0,
    totalVolume24h: 0,
    trending: [],
    tokens: [],
  };
}

function emptyTokenDetail(address: string, chainKey: ChainKey): TokenDetail {
  const config = getChainConfig(chainKey);
  return {
    chainKey,
    chainId: config.chainId,
    address,
    name: 'Unknown Token',
    symbol: 'UNKNOWN',
    quoteSymbol: config.wrappedNativeSymbol,
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
    pairLabel: `UNKNOWN / ${config.wrappedNativeSymbol}`,
    chart: [],
    trades: [],
    explorerBaseUrl: config.explorerBaseUrl,
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

export function getMarketOverview(chainKey?: string): Promise<MarketOverview> {
  const normalized = normalizeChainKey(chainKey);
  return request<MarketOverview>(`/tokens?chain=${normalized}`).catch(() => emptyOverview(normalized));
}

export function getTokenDetail(address: string, chainKey?: string): Promise<TokenDetail> {
  const normalized = normalizeChainKey(chainKey);
  return request<TokenDetail>(`/tokens/${address}?chain=${normalized}`).catch(() => emptyTokenDetail(address, normalized));
}
