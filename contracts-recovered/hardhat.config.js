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
    robinhood: {
      url: process.env.ROBINHOOD_RPC_URL || '',
      chainId: 4663,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || '',
      base: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || '',
      robinhood: process.env.ROBINHOODSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=8453',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'robinhood',
        chainId: 4663,
        urls: {
          apiURL: 'https://robinhoodchain.blockscout.com/api',
          browserURL: 'https://robinhoodchain.blockscout.com',
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
};

module.exports = config;
