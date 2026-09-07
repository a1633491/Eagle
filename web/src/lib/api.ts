import { marketOverview, tokenDetails } from '@/lib/mock-data';
import { ApiResponse, MarketOverview, TokenDetail } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

async function request<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as ApiResponse<T>;
    return payload.data;
  } catch {
    return fallback;
  }
}

export function getMarketOverview(): Promise<MarketOverview> {
  return request('/tokens', marketOverview);
}

export function getTokenDetail(address: string): Promise<TokenDetail> {
  const fallback = tokenDetails.find((item) => item.address === address) ?? tokenDetails[0];
  return request(`/tokens/${address}`, fallback);
}
