# Recovered Contracts

These files were recovered from flattened BscScan source pasted into `contract-sources/`.

## Workspace

- `src/`: raw recovered flattened files kept for reference
- `contracts/BrewLaunchSuite.sol`: deployable compile entry copied from the most complete recovered file
- `scripts/deploy.ts`: deploys `EagleFactory` first, reads `locker()`, then deploys `EagleDistributorFactory`
- `.env.example`: required deployment parameters
- `hardhat.config.ts`: standalone Hardhat config for this subproject

## Files

- `src/BrewFactory.flat.sol`
- `src/BrewLiquidityLocker.flat.sol`
- `src/BrewDistributorFactory.flat.sol`
- `contracts/BrewLaunchSuite.sol`

## Notes

- The cleaned `.sol` files are standalone flattened sources.
- Repeated `SPDX`, extra `pragma`, and flattened `import` lines were removed.
- `BrewDistributorFactory.flat.sol` is the most complete single file. It contains the original recovered contracts:
  - `BrewHolderDistributor`
  - `BrewDistributorFactory`
  - `BrewFactory`
  - `BrewLiquidityLocker`
  - `BrewToken`
  - `TickMath`
  - required Pancake V3 and OpenZeppelin pieces

## Deployment Order

1. Deploy `EagleFactory`
2. Read `locker()` from the deployed factory
3. Deploy `EagleDistributorFactory` with the `EagleFactory` address

The provided `scripts/deploy.ts` already follows this order automatically.

## Important Constructor Params

### EagleFactory

`constructor(
    IPancakeV3Factory pancakeV3Factory_,
    INonfungiblePositionManager positionManager_,
    address wbnb_,
    address owner_,
    address treasury_,
    uint256 launchFeeWei_,
    uint16 protocolLpFeeBps_
)`

Important: `EagleFactory` deploys `EagleLiquidityLocker` internally in its constructor:

`locker = new EagleLiquidityLocker(positionManager_, address(this));`

### EagleDistributorFactory

`constructor(EagleFactory brewFactory_)`

### EagleLiquidityLocker

`constructor(INonfungiblePositionManager positionManager_, address brewFactory_)`

This is useful for understanding the locker, but in the deployable Eagle architecture it is spawned by `EagleFactory`, not deployed manually first.

## Must Replace For Your Own Deployment

- `FACTORY_OWNER`: the admin wallet that can call `setTreasury`, `setLaunchFee`, `setProtocolLpFeeBps`, `setPaused`
- `FACTORY_TREASURY`: protocol revenue receiver in `EagleFactory` and `EagleLiquidityLocker`
- `PANCAKE_V3_FACTORY`, `PANCAKE_POSITION_MANAGER`, `WBNB`: chain-specific infrastructure addresses
- `LAUNCH_FEE_WEI`, `PROTOCOL_LP_FEE_BPS`: your platform fee configuration
- Branding strings inside `contracts/BrewLaunchSuite.sol`, especially `string public constant EAGLE = "launch on eagle.family"`

## Fee Flow

- Platform share: auto-transferred to `FACTORY_TREASURY` during each fee collection
- Creator share: remains in `claimableFees` and must be claimed manually
- Holder distributor path: still works, because the distributor is just another creator fee recipient that calls `claimFees`

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill in your owner, treasury, RPC, deployer key, and `BSCSCAN_API_KEY`
3. Run `npm install`
4. Run `npm run compile`
5. Run `npm run deploy:bsc` or `npm run deploy -- --network base`
6. Run `npm run verify:bsc` or `npm run verify -- --network base`

Deployment output is written to `deployments/bsc.json`.
