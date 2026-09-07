import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export type VerifyTokenRequest = {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  factoryAddress: string;
  metadataURI: string;
  creator: string;
};

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function contractsProjectDir() {
  const configured = process.env.CONTRACTS_PROJECT_DIR?.trim();
  const projectDir = configured
    ? path.resolve(process.cwd(), configured)
    : path.resolve(process.cwd(), '..', 'contracts-recovered');

  if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
    throw new Error(`Contracts project not found: ${projectDir}`);
  }

  return projectDir;
}

export function validateVerifyTokenRequest(payload: VerifyTokenRequest) {
  if (!isAddress(payload.address)) return 'Invalid token address';
  if (!isAddress(payload.factoryAddress)) return 'Invalid factory address';
  if (!isAddress(payload.creator)) return 'Invalid creator address';
  if (!payload.name.trim()) return 'Token name is required';
  if (!payload.symbol.trim()) return 'Token symbol is required';
  if (!/^\d+$/.test(payload.totalSupply.trim())) return 'Total supply must be an integer string';
  if (!payload.metadataURI.trim()) return 'Metadata URI is required';
  return null;
}

export function queueTokenVerification(payload: VerifyTokenRequest) {
  const cwd = contractsProjectDir();
  const child = spawn(
    npmCommand(),
    ['run', 'verify:token:bsc'],
    {
      cwd,
      env: {
        ...process.env,
        VERIFY_TOKEN_ADDRESS: payload.address,
        VERIFY_TOKEN_NAME: payload.name,
        VERIFY_TOKEN_SYMBOL: payload.symbol,
        VERIFY_TOKEN_TOTAL_SUPPLY: payload.totalSupply,
        VERIFY_TOKEN_FACTORY_ADDRESS: payload.factoryAddress,
        VERIFY_TOKEN_METADATA_URI: payload.metadataURI,
        VERIFY_TOKEN_CREATOR: payload.creator,
      },
      detached: true,
      stdio: 'ignore',
    },
  );

  child.unref();
}
