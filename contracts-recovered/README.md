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

## Robinhood Brew Quick Start

Robinhood Chain can deploy the Brew launch suite on top of Uni v3. The deploy script still uses the legacy env names `PANCAKE_V3_FACTORY` and `PANCAKE_POSITION_MANAGER`, but on Robinhood they should point to the Uni v3 contracts below:

- `ROBINHOOD_RPC_URL`
- `ROBINHOODSCAN_API_KEY` (optional, for Blockscout verification)
- `PANCAKE_V3_FACTORY=0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`
- `PANCAKE_POSITION_MANAGER=0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3`
- `WBNB=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`

The Robinhood-specific Brew scripts are:

- `npm run deploy:robinhood`
- `npm run verify:robinhood`

Deployment output is written to `deployments/robinhood.json`.

Current Robinhood Brew deployment:

- `EagleFactory`: `0xA1821b220716cE0bADb708Cd7A507D791f83437a`
- `EagleLiquidityLocker`: `0xf14Bc7e40Db50D5655957EFE87cB6f20d11AE872`
- `EagleDistributorFactory`: `0xaE62EE1fb7Db56Db5ef7DeC817E573b3DDE0Af23`
- Factory deployment block: `61867248`

## Robinhood v4 Quick Start

For the Robinhood Chain Uni v4 launch suite, add these extra envs on top of the standard owner / treasury / deployer settings:

- `ROBINHOOD_RPC_URL`
- `ROBINHOODSCAN_API_KEY` (optional, for Blockscout verification)
- `UNISWAP_V4_POOL_MANAGER=0x8366a39CC670B4001A1121B8F6A443A643e40951`
- `UNISWAP_V4_POSITION_MANAGER=0x58daec3116aae6D93017bAAea7749052E8a04fA7`
- `UNISWAP_V4_QUOTER=0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94`
- `UNISWAP_V4_STATE_VIEW=0xF3334192D15450CdD385c8B70e03f9A6bD9E673b`
- `UNISWAP_UNIVERSAL_ROUTER=0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99`
- `PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3`
- `WETH=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`

The Robinhood-specific scripts are:

- `npm run deploy:robinhood-v4`
- `npm run verify:robinhood-v4`

Deployment output is written to `deployments/robinhood-v4.json`.

## Legacy Quick Start

1. Copy `.env.example` to `.env`
2. Fill in your owner, treasury, RPC, deployer key, and `BSCSCAN_API_KEY`
3. Run `npm install`
4. Run `npm run compile`
5. Run `npm run deploy:bsc` or `npm run deploy -- --network base`
6. Run `npm run verify:bsc` or `npm run verify -- --network base`

Deployment output is written to `deployments/bsc.json`.
