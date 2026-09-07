const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

function getFlagValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function resolveFactoryAddress() {
  const fromEnv = process.env.EAGLE_FACTORY_ADDRESS?.trim();
  if (fromEnv) {
    if (!hre.ethers.isAddress(fromEnv)) {
      throw new Error(`Invalid EAGLE_FACTORY_ADDRESS: ${fromEnv}`);
    }
    return fromEnv;
  }

  const deploymentFile = path.join(process.cwd(), 'deployments', `${hre.network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Missing deployment file: ${deploymentFile}`);
  }

  const parsed = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

  if (!parsed.eagleFactory || !hre.ethers.isAddress(parsed.eagleFactory)) {
    throw new Error(`Invalid eagleFactory address in ${deploymentFile}`);
  }

  return parsed.eagleFactory;
}

async function main() {
  const feeArg = getFlagValue('--fee') ?? process.env.LAUNCH_FEE_WEI_OVERRIDE ?? '0';
  const nextFee = BigInt(feeArg);
  const factoryAddress = resolveFactoryAddress();

  const [signer] = await hre.ethers.getSigners();
  if (!signer) {
    throw new Error('No signer available');
  }

  const eagleFactory = await hre.ethers.getContractAt('EagleFactory', factoryAddress, signer);
  const owner = await eagleFactory.owner();
  const currentFee = await eagleFactory.launchFeeWei();

  console.log(`Network: ${hre.network.name}`);
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Current launch fee: ${currentFee.toString()}`);
  console.log(`Next launch fee: ${nextFee.toString()}`);

  if (signer.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Configured signer is not the factory owner');
  }

  if (currentFee === nextFee) {
    console.log('Launch fee already matches target value. No transaction sent.');
    return;
  }

  const tx = await eagleFactory.setLaunchFee(nextFee);
  console.log(`Submitted tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt?.blockNumber}`);

  const updatedFee = await eagleFactory.launchFeeWei();
  console.log(`Updated launch fee: ${updatedFee.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
