const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function verify(entry, label) {
  try {
    await hre.run('verify:verify', {
      address: entry.address,
      contract: entry.contract,
      constructorArguments: entry.constructorArguments,
    });
    console.log(`Verified ${label}: ${entry.address}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Already Verified') || message.includes('already verified')) {
      console.log(`Already verified ${label}: ${entry.address}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const deploymentFile = path.join(process.cwd(), 'deployments', `${hre.network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

  await verify(deployment.verification.eagleFactory, 'EagleFactory');
  await verify(deployment.verification.eagleLiquidityLocker, 'EagleLiquidityLocker');
  await verify(deployment.verification.eagleDistributorFactory, 'EagleDistributorFactory');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
