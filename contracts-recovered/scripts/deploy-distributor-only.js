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

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer account available');
  }

  const eagleFactoryAddress = requiredAddress('EAGLE_FACTORY_ADDRESS');
  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Factory: ${eagleFactoryAddress}`);

  const distributorFactoryFactory = await hre.ethers.getContractFactory('EagleDistributorFactory');
  const distributorFactory = await distributorFactoryFactory.deploy(eagleFactoryAddress);
  await distributorFactory.waitForDeployment();

  const distributorFactoryAddress = await distributorFactory.getAddress();
  console.log(`DistributorFactory: ${distributorFactoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
