import type { Address } from 'viem';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

export type UniswapQuoteRequest = {
  chainKey: 'robinhood';
  swapper: Address;
  tokenIn: Address;
  tokenOut: Address;
  amount: string;
  slippageTolerance?: number;
};

export type UniswapQuoteResponse = {
  requestId?: string;
  routing?: string;
  permitData?: unknown;
  quoteId?: string;
  isTokenApprovalApplicable?: boolean;
  quote?: {
    output?: {
      amount?: string;
      token?: string;
    };
  };
  route?: string[];
  gasUseEstimateUSD?: string;
  priceImpact?: number;
};

export type UniswapTransaction = {
  to: Address;
  from?: Address;
  data: `0x${string}`;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
};

export type UniswapApprovalResponse = {
  requestId?: string;
  approval: UniswapTransaction | null;
  cancel: UniswapTransaction | null;
  gasFee?: string;
};

export type UniswapSwapResponse = {
  requestId?: string;
  swap: UniswapTransaction;
  gasFee?: string;
};

export async function getUniswapQuote(request: UniswapQuoteRequest) {
  const response = await fetch(`${API_BASE}/swap/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as {
    code: number;
    msg: string;
    data?: UniswapQuoteResponse;
  };

  if (!response.ok || payload.code !== 200 || !payload.data) {
    throw new Error(payload.msg || 'Failed to fetch quote');
  }

  return payload.data;
}

export async function checkUniswapApproval(request: UniswapQuoteRequest) {
  const response = await fetch(`${API_BASE}/swap/check-approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as {
    code: number;
    msg: string;
    data?: UniswapApprovalResponse;
  };

  if (!response.ok || payload.code !== 200 || !payload.data) {
    throw new Error(payload.msg || 'Failed to check approval');
  }

  return payload.data;
}

export async function buildUniswapSwap(quote: UniswapQuoteResponse) {
  const response = await fetch(`${API_BASE}/swap/build`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ quote }),
  });

  const payload = (await response.json()) as {
    code: number;
    msg: string;
    data?: UniswapSwapResponse;
  };

  if (!response.ok || payload.code !== 200 || !payload.data) {
    throw new Error(payload.msg || 'Failed to build swap transaction');
  }

  return payload.data;
}
