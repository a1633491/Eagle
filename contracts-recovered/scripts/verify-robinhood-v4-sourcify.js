const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function verify(address, contract) {
  await hre.run('verify:sourcify', {
    address,
    contract,
  });
}

async function main() {
  const deploymentFile = path.join(process.cwd(), 'deployments', `${hre.network.name}-v4.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

  await verify(
    deployment.verification.robinhoodV4Factory.address,
    deployment.verification.robinhoodV4Factory.contract,
  );

  await verify(
    deployment.verification.robinhoodV4LiquidityLocker.address,
    deployment.verification.robinhoodV4LiquidityLocker.contract,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
