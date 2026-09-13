const hre = require('hardhat');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function requiredAddress(name) {
  const value = requiredEnv(name);
  if (!hre.ethers.isAddress(value)) {
    throw new Error(`Invalid address in ${name}: ${value}`);
  }
  return value;
}

function requiredNumber(name) {
  const value = Number(requiredEnv(name));
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer in ${name}: ${value}`);
  }
  return value;
}

function requiredBigInt(name) {
  const value = requiredEnv(name);
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid bigint in ${name}: ${value}`);
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer account available');
  }

  const poolManager = requiredAddress('UNISWAP_V4_POOL_MANAGER');
  const positionManager = requiredAddress('UNISWAP_V4_POSITION_MANAGER');
  const wrappedNative = requiredAddress('WETH');
  const owner = requiredAddress('FACTORY_OWNER');
  const treasury = requiredAddress('FACTORY_TREASURY');
  const protocolLpFeeBps = requiredNumber('PROTOCOL_LP_FEE_BPS');
  const smokeLaunchFeeWei =
    process.env.SMOKE_LAUNCH_FEE_WEI !== undefined ? BigInt(process.env.SMOKE_LAUNCH_FEE_WEI) : 0n;
  const quoteToken = process.env.SMOKE_QUOTE_TOKEN || wrappedNative;
  const fee = process.env.SMOKE_POOL_FEE ? Number(process.env.SMOKE_POOL_FEE) : 10_000;
  const tickSpacing = process.env.SMOKE_TICK_SPACING ? Number(process.env.SMOKE_TICK_SPACING) : 200;
  const initialTick = process.env.SMOKE_INITIAL_TICK ? Number(process.env.SMOKE_INITIAL_TICK) : 0;
  const totalSupply =
    process.env.SMOKE_TOTAL_SUPPLY !== undefined ? requiredBigInt('SMOKE_TOTAL_SUPPLY') : 1_000_000_000n * 10n ** 18n;
  const maxLaunchFeeWei =
    process.env.SMOKE_MAX_LAUNCH_FEE_WEI !== undefined ? requiredBigInt('SMOKE_MAX_LAUNCH_FEE_WEI') : smokeLaunchFeeWei;
  const saltSource = process.env.SMOKE_SALT || `${Date.now()}`;
  const salt = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(saltSource));

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Smoke launch fee: ${smokeLaunchFeeWei.toString()}`);

  const factoryFactory = await hre.ethers.getContractFactory('RobinhoodV4Factory');
  const factory = await factoryFactory.deploy(
    poolManager,
    positionManager,
    wrappedNative,
    owner,
    treasury,
    smokeLaunchFeeWei,
    protocolLpFeeBps,
  );
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const lockerAddress = await factory.locker();
  console.log(`Smoke factory deployed: ${factoryAddress}`);
  console.log(`Smoke locker deployed: ${lockerAddress}`);

  const params = {
    name: `Smoke Robinhood ${Date.now()}`,
    symbol: 'SRH',
    metadataURI: 'data:application/json,%7B%22name%22%3A%22Smoke%20Robinhood%22%2C%22symbol%22%3A%22SRH%22%7D',
    totalSupply,
    quoteToken,
    fee,
    tickSpacing,
    initialTick,
    hooks: hre.ethers.ZeroAddress,
    positions: [],
    creatorFeeRecipient: deployer.address,
    initialBuyQuoteAmount: 0,
    initialBuyMinTokensOut: 0,
    initialBuyRecipient: hre.ethers.ZeroAddress,
    salt,
    maxLaunchFeeWei,
  };

  const gasEstimate = await factory.launch.estimateGas(params, { value: smokeLaunchFeeWei });
  console.log(`Estimated launch gas: ${gasEstimate.toString()}`);

  const tx = await factory.launch(params, { value: smokeLaunchFeeWei });
  const receipt = await tx.wait();
  console.log(`Launch tx hash: ${receipt.hash}`);

  const launchEvent = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log) => log && log.name === 'TokenLaunched');

  if (!launchEvent) {
    throw new Error('TokenLaunched event not found in receipt');
  }

  const tokenAddress = launchEvent.args.token;
  const positions = await factory.totalLaunches();
  const locker = await hre.ethers.getContractAt('RobinhoodV4LiquidityLocker', lockerAddress);
  const lockedIds = await locker.positionsOf(tokenAddress);

  console.log(
    JSON.stringify(
      {
        factoryAddress,
        lockerAddress,
        tokenAddress,
        totalLaunches: positions.toString(),
        lockedPositionIds: lockedIds.map((id) => id.toString()),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
