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

## Multi-chain quick start

The active Brew deployment targets are:

- `bsc` -> PancakeSwap V3 infra
- `base` -> PancakeSwap V3 infra
- `robinhood` -> Uni v3 infra using the same Brew launch suite

All three chains use the same constructor shape and fee model:

- launch fee: `0.01`
- protocol LP fee share: `5000` bps
- treasury / owner: `0x29033EFBFA79351DBE1993c6e664A2104F050Fb5`

### BSC

- RPC env: `BSC_RPC_URL`
- DEX factory: `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865`
- Position manager: `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364`
- Wrapped native: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- Deploy: `npm run deploy:bsc`
- Verify: `npm run verify:bsc`
- Output: `deployments/bsc.json`

Current BSC deployment:

- `EagleFactory`: `0xEfca26BAc433975a27E894eeD196C8a1D32c4beE`
- `EagleLiquidityLocker`: `0x01ec131cF83F2978780D969b79f4839090618187`
- `EagleDistributorFactory`: `0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726`

### Base

- RPC env: `BASE_RPC_URL`
- DEX factory: `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865`
- Position manager: `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364`
- Wrapped native: `0x4200000000000000000000000000000000000006`
- Deploy: `npm run deploy -- --network base`
- Verify: `npm run verify -- --network base`
- Output: `deployments/base.json`

Current Base deployment:

- `EagleFactory`: `0xEfca26BAc433975a27E894eeD196C8a1D32c4beE`
- `EagleLiquidityLocker`: `0x01ec131cF83F2978780D969b79f4839090618187`
- `EagleDistributorFactory`: `0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726`

### Robinhood Brew Quick Start

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

- `EagleFactory`: `0x3A4CE33bb65b9429465b6EAda2F29C9f7bF0a122`
- `EagleLiquidityLocker`: `0x7DF4EE3EF16856cc2A834860558ac72Dea997641`
- `EagleDistributorFactory`: `0x834BEB67eA63d4246BD6B7D1928b2EBD57838F8c`
- Factory deployment block: `61971645`

## Robinhood v4 Quick Start

This path is legacy reference only. The active Robinhood production route is the Brew suite on top of Uni v3 from `deployments/robinhood.json`.

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

## Generic setup

1. Copy `.env.example` to `.env`
2. Fill in your owner, treasury, RPC, deployer key, and explorer API key for the target chain
3. Run `npm install`
4. Run `npm run compile`
5. Run the deploy command for your chain
6. Run the matching verify command

Deployment output is written to `deployments/<network>.json`.
