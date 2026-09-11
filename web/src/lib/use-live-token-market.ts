'use client';

import { useEffect, useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { getChainConfig, type ChainKey } from '@/lib/chains';

export type LiveTokenMarket = {
  priceUsd?: number;
  change24h?: number;
  volume24h?: number;
  liquidity?: number;
  marketCap?: number;
  poolAddress?: string;
  quoteSymbol?: string;
};

type DexPair = {
  chainId?: string;
  pairAddress?: string;
  priceUsd?: string;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  priceChange?: { h24?: number };
  quoteToken?: { symbol?: string; address?: string };
};

type DexPayload = {
  pairs?: DexPair[];
};

export function useLiveTokenMarket(tokenAddress: string | undefined, chainKey: ChainKey, fallback?: LiveTokenMarket) {
  const [market, setMarket] = useState<LiveTokenMarket | null>(fallback ?? null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tokenAddress || !isAddress(tokenAddress)) {
        if (!cancelled) setMarket(fallback ?? null);
        return;
      }

      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
          signal: AbortSignal.timeout(4000),
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as DexPayload;
        const pairs = (payload.pairs ?? []).filter((pair) => pair.chainId === getChainConfig(chainKey).dexscreenerChainId);
        if (!pairs.length) return;
        const bestPair = [...pairs].sort(
          (left, right) => Number(right.liquidity?.usd ?? 0) - Number(left.liquidity?.usd ?? 0),
        )[0];

        if (!cancelled) {
          setMarket({
            priceUsd: Number(bestPair.priceUsd ?? 0) || fallback?.priceUsd,
            change24h: Number(bestPair.priceChange?.h24 ?? 0),
            volume24h: Number(bestPair.volume?.h24 ?? 0),
            liquidity: Number(bestPair.liquidity?.usd ?? 0),
            marketCap: Number(bestPair.marketCap ?? bestPair.fdv ?? 0),
            poolAddress: bestPair.pairAddress,
            quoteSymbol: bestPair.quoteToken?.symbol ?? fallback?.quoteSymbol,
          });
        }
      } catch {
        if (!cancelled && fallback) {
          setMarket(fallback);
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [chainKey, fallback, tokenAddress]);

  return useMemo(() => market ?? fallback ?? {}, [fallback, market]);
}
