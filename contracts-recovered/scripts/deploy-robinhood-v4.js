const fs = require('fs');
const path = require('path');
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

function requiredBigInt(name) {
  const value = requiredEnv(name);
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid bigint in ${name}: ${value}`);
  }
}

function requiredNumber(name) {
  const value = Number(requiredEnv(name));
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer in ${name}: ${value}`);
  }
  return value;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer account available');
  }

  const params = {
    poolManager: requiredAddress('UNISWAP_V4_POOL_MANAGER'),
    positionManager: requiredAddress('UNISWAP_V4_POSITION_MANAGER'),
    wrappedNative: requiredAddress('WETH'),
    owner: requiredAddress('FACTORY_OWNER'),
    treasury: requiredAddress('FACTORY_TREASURY'),
    launchFeeWei: requiredBigInt('LAUNCH_FEE_WEI'),
    protocolLpFeeBps: requiredNumber('PROTOCOL_LP_FEE_BPS'),
  };

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Factory owner: ${params.owner}`);
  console.log(`Factory treasury: ${params.treasury}`);

  const factoryFactory = await hre.ethers.getContractFactory('RobinhoodV4Factory');
  const factory = await factoryFactory.deploy(
    params.poolManager,
    params.positionManager,
    params.wrappedNative,
    params.owner,
    params.treasury,
    params.launchFeeWei,
    params.protocolLpFeeBps,
  );
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const lockerAddress = await factory.locker();

  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    uniswapV4PoolManager: params.poolManager,
    uniswapV4PositionManager: params.positionManager,
    wrappedNative: params.wrappedNative,
    owner: params.owner,
    treasury: params.treasury,
    launchFeeWei: params.launchFeeWei.toString(),
    protocolLpFeeBps: params.protocolLpFeeBps,
    robinhoodV4Factory: factoryAddress,
    robinhoodV4LiquidityLocker: lockerAddress,
    verification: {
      robinhoodV4Factory: {
        address: factoryAddress,
        contract: 'contracts/RobinhoodUniV4LaunchSuite.sol:RobinhoodV4Factory',
        constructorArguments: [
          params.poolManager,
          params.positionManager,
          params.wrappedNative,
          params.owner,
          params.treasury,
          params.launchFeeWei.toString(),
          params.protocolLpFeeBps,
        ],
      },
      robinhoodV4LiquidityLocker: {
        address: lockerAddress,
        contract: 'contracts/RobinhoodUniV4LaunchSuite.sol:RobinhoodV4LiquidityLocker',
        constructorArguments: [params.positionManager, factoryAddress],
      },
    },
  };

  const outputDir = path.join(process.cwd(), 'deployments');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${hre.network.name}-v4.json`);
  fs.writeFileSync(outputFile, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log('Deployment complete');
  console.log(JSON.stringify(deployment, null, 2));
  console.log(`Saved to ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
