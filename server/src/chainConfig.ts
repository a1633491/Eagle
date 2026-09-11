export type ChainKey = 'bsc' | 'base';

type ServerChainConfig = {
  key: ChainKey;
  chainId: number;
  name: string;
  nativeSymbol: string;
  wrappedNativeSymbol: string;
  wrappedNativeToken: string;
  stableSymbol: string;
  stableToken: string;
  explorerBaseUrl: string;
  dexscreenerChainId: ChainKey;
  rpcEnvKey: string;
  factoryEnvKey: string;
  factoryStartBlockEnvKey: string;
  defaultFactoryAddress?: string;
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
    defaultFactoryAddress: '0xEfca26BAc433975a27E894eeD196C8a1D32c4beE',
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
    defaultFactoryAddress: '0xEfca26BAc433975a27E894eeD196C8a1D32c4beE',
  },
};

export function normalizeChainKey(value?: string): ChainKey {
  return value === 'base' ? 'base' : 'bsc';
}

export function getChainConfig(chainKey: ChainKey) {
  return chainConfigs[chainKey];
}

export function getConfiguredRpcUrl(chainKey: ChainKey) {
  const config = getChainConfig(chainKey);
  return process.env[config.rpcEnvKey]?.trim();
}

export function getConfiguredFactoryAddress(chainKey: ChainKey) {
  const config = getChainConfig(chainKey);
  const override = process.env[config.factoryEnvKey]?.trim();
  return override || config.defaultFactoryAddress;
}

export function getConfiguredStartBlock(chainKey: ChainKey) {
  const config = getChainConfig(chainKey);
  return process.env[config.factoryStartBlockEnvKey]?.trim();
}

export function getFactorySyncStateKey(chainKey: ChainKey) {
  return `factory-launch-sync:${chainKey}`;
}
