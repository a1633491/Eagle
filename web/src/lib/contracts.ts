import { type Address, erc20Abi } from 'viem';
import { getChainConfig, type ChainKey } from '@/lib/chains';

export type EagleContracts = {
  chainId: number;
  factory?: Address;
  locker?: Address;
  distributorFactory?: Address;
  wrappedNativeToken: Address;
  stableToken: Address;
};

export function getEagleContracts(chainKey: ChainKey): EagleContracts {
  const config = getChainConfig(chainKey);
  return {
    chainId: config.chainId,
    factory: config.factory,
    locker: config.locker,
    distributorFactory: config.distributorFactory,
    wrappedNativeToken: config.wrappedNativeToken,
    stableToken: config.stableToken,
  };
}

export const eagleContracts = getEagleContracts('bsc');

export const eagleFactoryAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
      { indexed: true, internalType: 'address', name: 'quoteToken', type: 'address' },
      { indexed: false, internalType: 'address', name: 'pool', type: 'address' },
      { indexed: false, internalType: 'uint24', name: 'fee', type: 'uint24' },
      { indexed: false, internalType: 'int24', name: 'initialTick', type: 'int24' },
      { indexed: false, internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
      { indexed: false, internalType: 'uint256[]', name: 'lockedPositionIds', type: 'uint256[]' },
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      { indexed: false, internalType: 'string', name: 'symbol', type: 'string' },
      { indexed: false, internalType: 'string', name: 'metadataURI', type: 'string' },
    ],
    name: 'TokenLaunched',
    type: 'event',
  },
  {
    inputs: [],
    name: 'launchFeeWei',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'locker',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'launches',
    outputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'quoteToken', type: 'address' },
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'address', name: 'creator', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint64', name: 'launchedAtBlock', type: 'uint64' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'creator', type: 'address' },
      { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
      { internalType: 'string', name: 'metadataURI', type: 'string' },
    ],
    name: 'predictTokenAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'symbol', type: 'string' },
          { internalType: 'string', name: 'metadataURI', type: 'string' },
          { internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
          { internalType: 'address', name: 'quoteToken', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'initialTick', type: 'int24' },
          {
            components: [
              { internalType: 'int24', name: 'tickLower', type: 'int24' },
              { internalType: 'int24', name: 'tickUpper', type: 'int24' },
              { internalType: 'uint16', name: 'bps', type: 'uint16' },
            ],
            internalType: 'struct EagleFactory.LiquidityPosition[]',
            name: 'positions',
            type: 'tuple[]',
          },
          { internalType: 'address', name: 'creatorFeeRecipient', type: 'address' },
          { internalType: 'uint256', name: 'initialBuyQuoteAmount', type: 'uint256' },
          { internalType: 'uint256', name: 'initialBuyMinTokensOut', type: 'uint256' },
          { internalType: 'address', name: 'initialBuyRecipient', type: 'address' },
          { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
          { internalType: 'uint256', name: 'maxLaunchFeeWei', type: 'uint256' },
        ],
        internalType: 'struct EagleFactory.LaunchParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'launch',
    outputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'uint256[]', name: 'positionIds', type: 'uint256[]' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

export const eagleLiquidityLockerAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'currency', type: 'address' },
    ],
    name: 'claimableFees',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'collectAllFees',
    outputs: [
      { internalType: 'uint256', name: 'total0', type: 'uint256' },
      { internalType: 'uint256', name: 'total1', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'currency', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
    ],
    name: 'claimFees',
    outputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export const eagleDistributorFactoryAbi = [
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'predict',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'distributorOf',
    outputs: [{ internalType: 'address', name: 'distributor', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'minTokensOut', type: 'uint256' },
    ],
    name: 'distribute',
    outputs: [
      { internalType: 'uint256', name: 'quoteSpent', type: 'uint256' },
      { internalType: 'uint256', name: 'tokensBurned', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export const eagleErc20Abi = erc20Abi;

export const supportedFeeTiers = [100, 500, 2500, 10000] as const;

export const tickSpacingByFeeTier: Record<(typeof supportedFeeTiers)[number], number> = {
  100: 1,
  500: 10,
  2500: 50,
  10000: 200,
};

export const defaultLaunchConfig = {
  totalSupply: BigInt(1_000_000_000) * BigInt(10) ** BigInt(18),
  feeTier: 10_000,
  initialTick: 0,
  targetLaunchPriceUsd: 0.0000049,
  initialBuyMinTokensOut: BigInt(0),
  maxLaunchFeeWeiFallback: BigInt('10000000000000000'),
} as const;
