import fs from 'fs';
import path from 'path';
import hre, { ethers } from 'hardhat';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function requiredAddress(name: string): string {
  const value = requiredEnv(name);
  if (!ethers.isAddress(value)) {
    throw new Error(`Invalid address in ${name}: ${value}`);
  }
  return value;
}

function requiredBigInt(name: string): bigint {
  const value = requiredEnv(name);
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid bigint in ${name}: ${value}`);
  }
}

function requiredNumber(name: string): number {
  const value = Number(requiredEnv(name));
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer in ${name}: ${value}`);
  }
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();
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
    protocolLpFeeBps: requiredNumber('PROTOCOL_LP_FEE_BPS')
  };

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Factory owner: ${params.owner}`);
  console.log(`Factory treasury: ${params.treasury}`);

  const eagleFactoryFactory = await ethers.getContractFactory('EagleFactory');
  const eagleFactory = await eagleFactoryFactory.deploy(
    params.pancakeV3Factory,
    params.positionManager,
    params.wbnb,
    params.owner,
    params.treasury,
    params.launchFeeWei,
    params.protocolLpFeeBps
  );
  await eagleFactory.waitForDeployment();

  const eagleFactoryAddress = await eagleFactory.getAddress();
  const lockerAddress = await eagleFactory.locker();

  const distributorFactoryFactory = await ethers.getContractFactory('EagleDistributorFactory');
  const distributorFactory = await distributorFactoryFactory.deploy(eagleFactoryAddress);
  await distributorFactory.waitForDeployment();

  const distributorFactoryAddress = await distributorFactory.getAddress();
  const deployment = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
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
        contract: 'contracts/BrewLaunchSuite.sol:EagleFactory',
        constructorArguments: [
          params.pancakeV3Factory,
          params.positionManager,
          params.wbnb,
          params.owner,
          params.treasury,
          params.launchFeeWei.toString(),
          params.protocolLpFeeBps
        ]
      },
      eagleLiquidityLocker: {
        address: lockerAddress,
        contract: 'contracts/BrewLaunchSuite.sol:EagleLiquidityLocker',
        constructorArguments: [params.positionManager, eagleFactoryAddress]
      },
      eagleDistributorFactory: {
        address: distributorFactoryAddress,
        contract: 'contracts/BrewLaunchSuite.sol:EagleDistributorFactory',
        constructorArguments: [eagleFactoryAddress]
      }
    }
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
