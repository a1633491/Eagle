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
      http: [
        process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com',
        'https://robinhood.drpc.org',
      ],
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
  poolManager: (process.env.NEXT_PUBLIC_ROBINHOOD_V4_POOL_MANAGER ??
    '0x8366a39CC670B4001A1121B8F6A443A643e40951') as Address,
  universalRouter: (process.env.NEXT_PUBLIC_ROBINHOOD_V4_UNIVERSAL_ROUTER ??
    '0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99') as Address,
  quoter: (process.env.NEXT_PUBLIC_ROBINHOOD_V4_QUOTER ??
    '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94') as Address,
  stateView: (process.env.NEXT_PUBLIC_ROBINHOOD_V4_STATE_VIEW ??
    '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b') as Address,
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
