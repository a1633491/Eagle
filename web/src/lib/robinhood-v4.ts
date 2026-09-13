import { defineChain, type Address } from 'viem';

export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Blockscout',
      url: 'https://robinhoodchain.blockscout.com',
    },
  },
});

export const robinhoodV4Contracts = {
  poolManager: process.env.NEXT_PUBLIC_ROBINHOOD_V4_POOL_MANAGER as Address | undefined,
  universalRouter: process.env.NEXT_PUBLIC_ROBINHOOD_V4_UNIVERSAL_ROUTER as Address | undefined,
  quoter: process.env.NEXT_PUBLIC_ROBINHOOD_V4_QUOTER as Address | undefined,
  stateView: process.env.NEXT_PUBLIC_ROBINHOOD_V4_STATE_VIEW as Address | undefined,
  permit2: (process.env.NEXT_PUBLIC_ROBINHOOD_V4_PERMIT2 ?? '0x000000000022D473030F116dDEE9F6B43aC78BA3') as Address,
};

export function isRobinhoodV4Configured() {
  return Boolean(
    robinhoodV4Contracts.poolManager &&
      robinhoodV4Contracts.universalRouter &&
      robinhoodV4Contracts.quoter &&
      robinhoodV4Contracts.stateView,
  );
}
