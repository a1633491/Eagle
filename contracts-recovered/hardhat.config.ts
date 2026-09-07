import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

dotenv.config();

const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const normalizedPrivateKey =
  privateKey && /^(0x)?[0-9a-fA-F]{64}$/.test(privateKey)
    ? privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`
    : undefined;
const accounts = normalizedPrivateKey ? [normalizedPrivateKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 800
      },
      viaIR: true
    }
  },
  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts'
  },
  networks: {
    hardhat: {},
    bsc: {
      url: process.env.BSC_RPC_URL || '',
      chainId: 56,
      accounts
    }
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY || ''
  }
};

export default config;
