import { defineChain } from 'viem';

const arcRpcCandidates = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_ARC_RPC_URL,
      'https://rpc.mainnet.arc.io',
      'https://rpc.blockdaemon.mainnet.arc.io',
    ].filter((value): value is string => Boolean(value)),
  ),
);

export const arcChain = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: arcRpcCandidates,
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.arc.io',
    },
  },
});

export const arcPublicRpcUrl = arcRpcCandidates[0];
