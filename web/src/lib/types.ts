export type TokenSummary = {
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
  metadataURI?: string;
};

export type Trade = {
  id: string;
  time: string;
  type: 'Buy' | 'Sell';
  amountToken: number;
  amountUsd: number;
  sender: string;
  priceUsd: number;
};

export type ChartPoint = {
  time: number;
  value: number;
};

export type TokenDetail = TokenSummary & {
  totalSupply: string;
  launchedDate: string;
  pairLabel: string;
  chart: ChartPoint[];
  trades: Trade[];
};

export type MarketOverview = {
  chain: string;
  launchedCount: number;
  totalVolume24h: number;
  trending: TokenDetail[];
  tokens: TokenDetail[];
};

export type ApiResponse<T> = {
  code: number;
  msg: string;
  data: T;
};
