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

async function resolveLockerAddress(factory, factoryAddress) {
  const currentProvider = hre.ethers.provider;
  const candidates = [];
  if (hre.network.name === 'base') {
    candidates.push(process.env.BASE_RPC_URL, 'https://mainnet.base.org', 'https://base-rpc.publicnode.com');
  }

  const encoded = factory.interface.encodeFunctionData('locker');
  const seen = new Set();
  const providers = [currentProvider];

  for (const url of candidates) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    providers.push(new hre.ethers.JsonRpcProvider(url));
  }

  let lastError;
  for (const provider of providers) {
    try {
      const code = await provider.getCode(factoryAddress);
      if (!code || code === '0x') {
        continue;
      }
      const result = await provider.call({ to: factoryAddress, data: encoded });
      if (!result || result === '0x') {
        continue;
      }
      return factory.interface.decodeFunctionResult('locker', result)[0];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to resolve locker() for factory ${factoryAddress}`);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer account available');
  }

  const params = {
    pancakeV3Factory: requiredAddress('PANCAKE_V3_FACTORY'),
    positionManager: requiredAddress('PANCAKE_POSITION_MANAGER'),
    wbnb: requiredAddress('WBNB'),
    owner: requiredAddress('FACTORY_OWNER'),
    treasury: requiredAddress('FACTORY_TREASURY'),
    launchFeeWei: requiredBigInt('LAUNCH_FEE_WEI'),
    protocolLpFeeBps: requiredNumber('PROTOCOL_LP_FEE_BPS'),
  };

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Factory owner: ${params.owner}`);
  console.log(`Factory treasury: ${params.treasury}`);

  const eagleFactoryFactory = await hre.ethers.getContractFactory('contracts/BrewLaunchSuite.sol:ZeroFactory');
  const eagleFactory = await eagleFactoryFactory.deploy(
    params.pancakeV3Factory,
    params.positionManager,
    params.wbnb,
    params.owner,
    params.treasury,
    params.launchFeeWei,
    params.protocolLpFeeBps,
  );
  await eagleFactory.waitForDeployment();

  const eagleFactoryAddress = await eagleFactory.getAddress();
  console.log(`Factory deployed: ${eagleFactoryAddress}`);
  const lockerAddress = await resolveLockerAddress(eagleFactory, eagleFactoryAddress);

  const distributorFactoryFactory = await hre.ethers.getContractFactory(
    'contracts/BrewLaunchSuite.sol:ZeroDistributorFactory',
  );
  const distributorFactory = await distributorFactoryFactory.deploy(eagleFactoryAddress);
  await distributorFactory.waitForDeployment();

  const distributorFactoryAddress = await distributorFactory.getAddress();
  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    pancakeV3Factory: params.pancakeV3Factory,
    positionManager: params.positionManager,
    wbnb: params.wbnb,
    owner: params.owner,
    treasury: params.treasury,
    launchFeeWei: params.launchFeeWei.toString(),
    protocolLpFeeBps: params.protocolLpFeeBps,
    eagleFactory: eagleFactoryAddress,
    eagleLiquidityLocker: lockerAddress,
    eagleDistributorFactory: distributorFactoryAddress,
    verification: {
      eagleFactory: {
        address: eagleFactoryAddress,
        contract: 'contracts/BrewLaunchSuite.sol:ZeroFactory',
        constructorArguments: [
          params.pancakeV3Factory,
          params.positionManager,
          params.wbnb,
          params.owner,
          params.treasury,
          params.launchFeeWei.toString(),
          params.protocolLpFeeBps,
        ],
      },
      eagleLiquidityLocker: {
        address: lockerAddress,
        contract: 'contracts/BrewLaunchSuite.sol:ZeroLiquidityLocker',
        constructorArguments: [params.positionManager, eagleFactoryAddress],
      },
      eagleDistributorFactory: {
        address: distributorFactoryAddress,
        contract: 'contracts/BrewLaunchSuite.sol:ZeroDistributorFactory',
        constructorArguments: [eagleFactoryAddress],
      },
    },
  };

  const outputDir = path.join(process.cwd(), 'deployments');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${hre.network.name}.json`);
  fs.writeFileSync(outputFile, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log('Deployment complete');
  console.log(JSON.stringify(deployment, null, 2));
  console.log(`Saved to ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
