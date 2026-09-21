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
  const deploymentFile = path.join(process.cwd(), 'deployments', `${hre.network.name}-v4.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  await verify(deployment.verification.robinhoodV4Factory, 'ZeroFactory');
  await verify(deployment.verification.robinhoodV4LiquidityLocker, 'ZeroLiquidityLocker');
  await verify(deployment.verification.robinhoodV4DistributorFactory, 'ZeroDistributorFactory');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
