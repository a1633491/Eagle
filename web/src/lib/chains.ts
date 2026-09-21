import { type Address, type Chain, zeroAddress } from 'viem';
import { base, bsc } from 'wagmi/chains';
import { arcChain } from '@/lib/arc';
import { robinhoodChain } from '@/lib/robinhood-v4';

export type ChainKey = 'bsc' | 'base' | 'robinhood' | 'arc';
export type DexScreenerChainId = 'bsc' | 'base' | 'robinhood' | 'arc';

type FrontendChainConfig = {
  key: ChainKey;
  chainId: number;
  name: string;
  shortName: string;
  wagmiChain: Chain;
  nativeSymbol: string;
  wrappedNativeSymbol: string;
  wrappedNativeToken: Address;
  nativeFirstBuyUsesValue?: boolean;
  stableSymbol: string;
  stableToken: Address;
  explorerBaseUrl: string;
  dexscreenerChainId: DexScreenerChainId;
  docsWebsite: string;
  anyTokenLabel: string;
  factory?: Address;
  locker?: Address;
  distributorFactory?: Address;
};

const bscFactory = (process.env.NEXT_PUBLIC_BSC_FACTORY_ADDRESS ??
  '0x9C0E862cD8a3993c8123292E2aD888713759C3f5') as Address;
const bscLocker = (process.env.NEXT_PUBLIC_BSC_LOCKER_ADDRESS ??
  '0x3D2Db6ee9731d8f19bd5D77166078a266f3eE820') as Address;
const bscDistributorFactory = (process.env.NEXT_PUBLIC_BSC_DISTRIBUTOR_FACTORY_ADDRESS ??
  '0x0e1922bD71BF5f584083E05bDB665aCD7abAe130') as Address;
const baseFactory = (process.env.NEXT_PUBLIC_BASE_FACTORY_ADDRESS ??
  '0x457291634E700971675060560BBFa6eA7dc27176') as Address;
const baseLocker = (process.env.NEXT_PUBLIC_BASE_LOCKER_ADDRESS ??
  '0x3649d68F352aCA7934a496Fa1499c0f74f5C4077') as Address;
const baseDistributorFactory = (process.env.NEXT_PUBLIC_BASE_DISTRIBUTOR_FACTORY_ADDRESS ??
  '0x4d3AA9f7f10FD370052c17494B2c4dE6B24d20Dc') as Address;
const robinhoodFactory = (process.env.NEXT_PUBLIC_ROBINHOOD_FACTORY_ADDRESS ??
  '0x2224A3A2e9bC11D3157E9Ab6440BD8AE58bFdF50') as Address;
const robinhoodLocker = (process.env.NEXT_PUBLIC_ROBINHOOD_LOCKER_ADDRESS ??
  '0x5E61D4d688F2a3594f6Ca03BC2d2e37eA8247827') as Address;
const robinhoodDistributorFactory = (process.env.NEXT_PUBLIC_ROBINHOOD_DISTRIBUTOR_FACTORY_ADDRESS ??
  '0x91aa7ADF55c60cfFD2d75c6bF6D9b06648393850') as Address;
const robinhoodWrappedNativeToken =
  (process.env.NEXT_PUBLIC_ROBINHOOD_WETH_ADDRESS ?? '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73') as Address;
const robinhoodStableToken =
  (process.env.NEXT_PUBLIC_ROBINHOOD_STABLE_TOKEN_ADDRESS ?? '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168') as Address;
const arcFactory = (process.env.NEXT_PUBLIC_ARC_FACTORY_ADDRESS ??
  '0x9D4417CCb6536e82e39dA1f258C79B2928983760') as Address;
const arcLocker = (process.env.NEXT_PUBLIC_ARC_LOCKER_ADDRESS ??
  '0xb55624004F0D5eb32D09E2d15C4126433052C0D9') as Address;
const arcDistributorFactory = (process.env.NEXT_PUBLIC_ARC_DISTRIBUTOR_FACTORY_ADDRESS ??
  '0x5878fBD635e67cae40A3a1ebf9B01D9AC3BB4915') as Address;
const arcWrappedNativeToken =
  (process.env.NEXT_PUBLIC_ARC_WRAPPED_NATIVE_TOKEN_ADDRESS ?? '0x3600000000000000000000000000000000000000') as Address;
const arcStableToken = (process.env.NEXT_PUBLIC_ARC_STABLE_TOKEN_ADDRESS ?? arcWrappedNativeToken) as Address;
const robinhoodEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ROBINHOOD_CHAIN === 'true' &&
  robinhoodWrappedNativeToken !== zeroAddress;
const arcEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ARC_CHAIN === 'true' &&
  arcFactory !== zeroAddress &&
  arcWrappedNativeToken !== zeroAddress;

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
    nativeFirstBuyUsesValue: true,
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
    nativeFirstBuyUsesValue: true,
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
  robinhood: {
    key: 'robinhood',
    chainId: robinhoodChain.id,
    name: 'Robinhood',
    shortName: 'Robinhood',
    wagmiChain: robinhoodChain,
    nativeSymbol: 'ETH',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeToken: robinhoodWrappedNativeToken,
    nativeFirstBuyUsesValue: true,
    stableSymbol: 'USDG',
    stableToken: robinhoodStableToken,
    explorerBaseUrl: 'https://robinhoodchain.blockscout.com',
    dexscreenerChainId: 'robinhood',
    docsWebsite: 'https://docs.robinhood.com/chain/',
    anyTokenLabel: 'Any Robinhood token',
    factory: robinhoodFactory,
    locker: robinhoodLocker,
    distributorFactory: robinhoodDistributorFactory,
  },
  arc: {
    key: 'arc',
    chainId: arcChain.id,
    name: 'Arc',
    shortName: 'Arc',
    wagmiChain: arcChain,
    nativeSymbol: 'USDC',
    wrappedNativeSymbol: 'USDC',
    wrappedNativeToken: arcWrappedNativeToken,
    // Arc exposes native USDC through an ERC20 interface and does not support a WETH-style deposit().
    nativeFirstBuyUsesValue: false,
    stableSymbol: process.env.NEXT_PUBLIC_ARC_STABLE_SYMBOL ?? 'USDC',
    stableToken: arcStableToken,
    explorerBaseUrl: 'https://explorer.arc.io',
    dexscreenerChainId: 'arc',
    docsWebsite: 'https://docs.arc.io/',
    anyTokenLabel: 'Any Arc token',
    factory: arcFactory,
    locker: arcLocker,
    distributorFactory: arcDistributorFactory,
  },
};

export function normalizeChainKey(value?: string): ChainKey {
  if (value === 'bsc') {
    return 'bsc';
  }

  if (value === 'arc' && arcEnabled) {
    return 'arc';
  }

  if (value === 'robinhood' && robinhoodEnabled) {
    return 'robinhood';
  }

  if (value === 'base') {
    return 'base';
  }

  if (arcEnabled) {
    return 'arc';
  }

  return 'bsc';
}

export function getChainConfig(chainKey: ChainKey) {
  return chainConfigs[chainKey];
}

export function getSupportedChainKeys(): ChainKey[] {
  const supported: ChainKey[] = [];
  if (arcEnabled) supported.push('arc');
  supported.push('bsc', 'base');
  if (robinhoodEnabled) supported.push('robinhood');
  return supported;
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
