import hre from 'hardhat';

const CONTRACT_NAME = 'contracts/BrewLaunchSuite.sol:EagleToken';
const RETRYABLE_PATTERNS = [
  /Unable to locate ContractCode/i,
  /does not have bytecode/i,
  /Missing bytecode/i,
  /The address is not a smart contract/i,
  /timed out/i,
  /Pending in queue/i,
];

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function shouldRetry(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(message));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const address = requiredEnv('VERIFY_TOKEN_ADDRESS');
  const name = requiredEnv('VERIFY_TOKEN_NAME');
  const symbol = requiredEnv('VERIFY_TOKEN_SYMBOL');
  const totalSupply = requiredEnv('VERIFY_TOKEN_TOTAL_SUPPLY');
  const factoryAddress = requiredEnv('VERIFY_TOKEN_FACTORY_ADDRESS');
  const metadataURI = requiredEnv('VERIFY_TOKEN_METADATA_URI');
  const creator = requiredEnv('VERIFY_TOKEN_CREATOR');

  const constructorArguments = [name, symbol, totalSupply, factoryAddress, metadataURI, creator];
  const attempts = Number(process.env.VERIFY_TOKEN_ATTEMPTS ?? '6');
  const delayMs = Number(process.env.VERIFY_TOKEN_RETRY_DELAY_MS ?? '15000');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await hre.run('verify:verify', {
        address,
        contract: CONTRACT_NAME,
        constructorArguments,
      });
      console.log(`Verified EagleToken: ${address}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Already Verified') || message.includes('already verified')) {
        console.log(`Already verified EagleToken: ${address}`);
        return;
      }

      if (attempt < attempts && shouldRetry(error)) {
        console.warn(`Retrying EagleToken verification (${attempt}/${attempts}) for ${address}: ${message}`);
        await sleep(delayMs);
        continue;
      }

      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
