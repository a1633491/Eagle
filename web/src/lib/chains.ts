import { type Address } from 'viem';
import { base, bsc, type Chain } from 'wagmi/chains';

export type ChainKey = 'bsc' | 'base';

type FrontendChainConfig = {
  key: ChainKey;
  chainId: number;
  name: string;
  shortName: string;
  wagmiChain: Chain;
  nativeSymbol: string;
  wrappedNativeSymbol: string;
  wrappedNativeToken: Address;
  stableSymbol: string;
  stableToken: Address;
  explorerBaseUrl: string;
  dexscreenerChainId: ChainKey;
  docsWebsite: string;
  anyTokenLabel: string;
  factory?: Address;
  locker?: Address;
  distributorFactory?: Address;
};

const bscFactory = (process.env.NEXT_PUBLIC_BSC_FACTORY_ADDRESS ??
  '0xEfca26BAc433975a27E894eeD196C8a1D32c4beE') as Address;
const bscLocker = (process.env.NEXT_PUBLIC_BSC_LOCKER_ADDRESS ??
  '0x01ec131cF83F2978780D969b79f4839090618187') as Address;
const bscDistributorFactory = (process.env.NEXT_PUBLIC_BSC_DISTRIBUTOR_FACTORY_ADDRESS ??
  '0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726') as Address;
const baseFactory = (process.env.NEXT_PUBLIC_BASE_FACTORY_ADDRESS ??
  '0xEfca26BAc433975a27E894eeD196C8a1D32c4beE') as Address;
const baseLocker = (process.env.NEXT_PUBLIC_BASE_LOCKER_ADDRESS ??
  '0x01ec131cF83F2978780D969b79f4839090618187') as Address;
const baseDistributorFactory = (process.env.NEXT_PUBLIC_BASE_DISTRIBUTOR_FACTORY_ADDRESS ??
  '0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726') as Address;

export const chainConfigs: Record<ChainKey, FrontendChainConfig> = {
  bsc: {
    key: 'bsc',
    chainId: bsc.id,
    name: 'BNB Chain',
    shortName: 'BNB',
    wagmiChain: bsc,
    nativeSymbol: 'BNB',
    wrappedNativeSymbol: 'WBNB',
    wrappedNativeToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    stableSymbol: 'USDT',
    stableToken: '0x55d398326f99059fF775485246999027B3197955',
    explorerBaseUrl: 'https://bscscan.com',
    dexscreenerChainId: 'bsc',
    docsWebsite: 'https://www.bnbchain.org/',
    anyTokenLabel: 'Any BSC token',
    factory: bscFactory,
    locker: bscLocker,
    distributorFactory: bscDistributorFactory,
  },
  base: {
    key: 'base',
    chainId: base.id,
    name: 'Base',
    shortName: 'Base',
    wagmiChain: base,
    nativeSymbol: 'ETH',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeToken: '0x4200000000000000000000000000000000000006',
    stableSymbol: 'USDC',
    stableToken: '0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913',
    explorerBaseUrl: 'https://basescan.org',
    dexscreenerChainId: 'base',
    docsWebsite: 'https://base.org/',
    anyTokenLabel: 'Any Base token',
    factory: baseFactory,
    locker: baseLocker,
    distributorFactory: baseDistributorFactory,
  },
};

export function normalizeChainKey(value?: string): ChainKey {
  return value === 'base' ? 'base' : 'bsc';
}

export function getChainConfig(chainKey: ChainKey) {
  return chainConfigs[chainKey];
}

export function withLangAndChain(href: string, lang: string, chainKey: ChainKey) {
  const url = new URL(href, 'https://eagle.local');
  url.searchParams.set('lang', lang);
  url.searchParams.set('chain', chainKey);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function withSearchChain(searchParams: URLSearchParams, nextChain: ChainKey) {
  const params = new URLSearchParams(searchParams.toString());
  params.set('chain', nextChain);
  return params;
}
