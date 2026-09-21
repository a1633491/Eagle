export type ChainKey = 'bsc' | 'base' | 'robinhood' | 'arc';
export type DexScreenerChainId = 'bsc' | 'base' | 'robinhood' | 'arc';

type ServerChainConfig = {
  key: ChainKey;
  chainId: number;
  name: string;
  nativeSymbol: string;
  wrappedNativeSymbol: string;
  wrappedNativeToken: string;
  wrappedNativeTokenEnvKey?: string;
  stableSymbol: string;
  stableSymbolEnvKey?: string;
  stableToken: string;
  stableTokenEnvKey?: string;
  explorerBaseUrl: string;
  dexscreenerChainId: DexScreenerChainId;
  rpcEnvKey: string;
  factoryEnvKey: string;
  factoryStartBlockEnvKey: string;
  supportsFactorySync?: boolean;
  defaultFactoryAddress?: string;
  defaultFactoryStartBlock?: string;
  defaultRpcUrls?: string[];
};

export const chainConfigs: Record<ChainKey, ServerChainConfig> = {
  bsc: {
    key: 'bsc',
    chainId: 56,
    name: 'BNB Chain',
    nativeSymbol: 'BNB',
    wrappedNativeSymbol: 'WBNB',
    wrappedNativeToken: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    stableSymbol: 'USDT',
    stableToken: '0x55d398326f99059ff775485246999027b3197955',
    explorerBaseUrl: 'https://bscscan.com',
    dexscreenerChainId: 'bsc',
    rpcEnvKey: 'BSC_RPC_URL',
    factoryEnvKey: 'EAGLE_FACTORY_ADDRESS',
    factoryStartBlockEnvKey: 'EAGLE_FACTORY_START_BLOCK',
    supportsFactorySync: true,
    defaultFactoryAddress: '0x9C0E862cD8a3993c8123292E2aD888713759C3f5',
    defaultFactoryStartBlock: '123158083',
    defaultRpcUrls: ['https://bsc-dataseed.bnbchain.org'],
  },
  base: {
    key: 'base',
    chainId: 8453,
    name: 'Base',
    nativeSymbol: 'ETH',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeToken: '0x4200000000000000000000000000000000000006',
    stableSymbol: 'USDC',
    stableToken: '0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913',
    explorerBaseUrl: 'https://basescan.org',
    dexscreenerChainId: 'base',
    rpcEnvKey: 'BASE_RPC_URL',
    factoryEnvKey: 'BASE_FACTORY_ADDRESS',
    factoryStartBlockEnvKey: 'BASE_FACTORY_START_BLOCK',
    supportsFactorySync: true,
    defaultFactoryAddress: '0x457291634E700971675060560BBFa6eA7dc27176',
    defaultFactoryStartBlock: '51596956',
    defaultRpcUrls: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
  },
  robinhood: {
    key: 'robinhood',
    chainId: 4663,
    name: 'Robinhood',
    nativeSymbol: 'ETH',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeToken: '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
    wrappedNativeTokenEnvKey: 'ROBINHOOD_WETH_ADDRESS',
    stableSymbol: 'USDG',
    stableSymbolEnvKey: 'ROBINHOOD_STABLE_SYMBOL',
    stableToken: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
    stableTokenEnvKey: 'ROBINHOOD_STABLE_TOKEN_ADDRESS',
    explorerBaseUrl: 'https://robinhoodchain.blockscout.com',
    dexscreenerChainId: 'robinhood',
    rpcEnvKey: 'ROBINHOOD_RPC_URL',
    factoryEnvKey: 'ROBINHOOD_FACTORY_ADDRESS',
    factoryStartBlockEnvKey: 'ROBINHOOD_FACTORY_START_BLOCK',
    supportsFactorySync: true,
    defaultFactoryAddress: '0x2224A3A2e9bC11D3157E9Ab6440BD8AE58bFdF50',
    defaultFactoryStartBlock: '68693414',
    defaultRpcUrls: ['https://rpc.mainnet.chain.robinhood.com', 'https://robinhood.drpc.org'],
  },
  arc: {
    key: 'arc',
    chainId: 5042,
    name: 'Arc',
    nativeSymbol: 'USDC',
    wrappedNativeSymbol: 'USDC',
    wrappedNativeToken: '0x3600000000000000000000000000000000000000',
    wrappedNativeTokenEnvKey: 'ARC_WRAPPED_NATIVE_TOKEN_ADDRESS',
    stableSymbol: 'USDC',
    stableSymbolEnvKey: 'ARC_STABLE_SYMBOL',
    stableToken: '0x3600000000000000000000000000000000000000',
    stableTokenEnvKey: 'ARC_STABLE_TOKEN_ADDRESS',
    explorerBaseUrl: 'https://explorer.arc.io',
    dexscreenerChainId: 'arc',
    rpcEnvKey: 'ARC_RPC_URL',
    factoryEnvKey: 'ARC_FACTORY_ADDRESS',
    factoryStartBlockEnvKey: 'ARC_FACTORY_START_BLOCK',
    supportsFactorySync: true,
    defaultFactoryAddress: '0x9D4417CCb6536e82e39dA1f258C79B2928983760',
    defaultFactoryStartBlock: '21988492',
    defaultRpcUrls: ['https://rpc.mainnet.arc.io', 'https://rpc.blockdaemon.mainnet.arc.io'],
  },
};

export function normalizeChainKey(value?: string): ChainKey {
  if (value === 'arc') return 'arc';
  if (value === 'robinhood') return 'robinhood';
  return value === 'base' ? 'base' : 'bsc';
}

export function getChainConfig(chainKey: ChainKey) {
  const config = chainConfigs[chainKey];
  return {
    ...config,
    wrappedNativeToken: config.wrappedNativeTokenEnvKey
      ? (process.env[config.wrappedNativeTokenEnvKey]?.trim().toLowerCase() || config.wrappedNativeToken)
      : config.wrappedNativeToken,
    stableSymbol: config.stableSymbolEnvKey ? process.env[config.stableSymbolEnvKey]?.trim() || config.stableSymbol : config.stableSymbol,
    stableToken: config.stableTokenEnvKey
      ? (process.env[config.stableTokenEnvKey]?.trim().toLowerCase() || config.stableToken)
      : config.stableToken,
  };
}

export function getConfiguredRpcUrl(chainKey: ChainKey) {
  return getConfiguredRpcUrls(chainKey)[0];
}

export function getConfiguredRpcUrls(chainKey: ChainKey) {
  const config = getChainConfig(chainKey);
  const configured = (process.env[config.rpcEnvKey] ?? '')
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([...configured, ...(config.defaultRpcUrls ?? [])])];
}

export function getConfiguredFactoryAddress(chainKey: ChainKey) {
  const config = getChainConfig(chainKey);
  const override = process.env[config.factoryEnvKey]?.trim();
  return override || config.defaultFactoryAddress;
}

export function getConfiguredStartBlock(chainKey: ChainKey) {
  const config = getChainConfig(chainKey);
  return process.env[config.factoryStartBlockEnvKey]?.trim() || config.defaultFactoryStartBlock;
}

export function getFactorySyncStateKey(chainKey: ChainKey) {
  return `factory-launch-sync:${chainKey}`;
}

export function supportsFactorySync(chainKey: ChainKey) {
  return Boolean(getChainConfig(chainKey).supportsFactorySync);
}
