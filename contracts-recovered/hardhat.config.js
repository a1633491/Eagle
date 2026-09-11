require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const normalizedPrivateKey =
  privateKey && /^(0x)?[0-9a-fA-F]{64}$/.test(privateKey)
    ? privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`
    : undefined;

const accounts = normalizedPrivateKey ? [normalizedPrivateKey] : [];

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {},
    bsc: {
      url: process.env.BSC_RPC_URL || '',
      chainId: 56,
      accounts,
    },
    base: {
      url: process.env.BASE_RPC_URL || '',
      chainId: 8453,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || '',
      base: process.env.BASESCAN_API_KEY || '',
    },
  },
};

module.exports = config;
