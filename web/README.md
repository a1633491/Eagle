## Eagle Web

Frontend for Eagle market, launch, swap, and wallet flows across BSC, Base, Robinhood, and Arc.

## Supported chains

### BSC

- Chain ID: `56`
- Launch venue: `PancakeSwap V3`
- Native token: `BNB`
- Stable token: `USDT`
- Default factory: `0xEfca26BAc433975a27E894eeD196C8a1D32c4beE`

### Base

- Chain ID: `8453`
- Launch venue: `PancakeSwap V3`
- Native token: `ETH`
- Stable token: `USDC`
- Default factory: `0xEfca26BAc433975a27E894eeD196C8a1D32c4beE`

### Robinhood

- Chain ID: `4663`
- Launch venue: `Uni v3`
- Native token: `ETH`
- Stable token: `USDG`
- Default factory: `0x3A4CE33bb65b9429465b6EAda2F29C9f7bF0a122`
- Recommended RPC: `https://robinhood.drpc.org`

### Arc

- Chain ID: `5042`
- Launch venue: `Uni v3`
- Native token: `USDC`
- Stable token: `USDC`
- Default factory: `0xEfca26BAc433975a27E894eeD196C8a1D32c4beE`
- Default locker: `0x01ec131cF83F2978780D969b79f4839090618187`
- Default distributor: `0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726`
- Recommended RPC: `https://rpc.mainnet.arc.io`

## Frontend envs

The UI works out of the box for BSC and Base using built-in defaults. For Robinhood and Arc, enable the chain switch and override addresses only when needed.

```bash
NEXT_PUBLIC_ENABLE_ROBINHOOD_CHAIN=true
NEXT_PUBLIC_ROBINHOOD_RPC_URL=https://robinhood.drpc.org
NEXT_PUBLIC_ROBINHOOD_WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
NEXT_PUBLIC_ROBINHOOD_STABLE_TOKEN_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
NEXT_PUBLIC_ROBINHOOD_FACTORY_ADDRESS=0x3A4CE33bb65b9429465b6EAda2F29C9f7bF0a122
NEXT_PUBLIC_ROBINHOOD_LOCKER_ADDRESS=0x7DF4EE3EF16856cc2A834860558ac72Dea997641
NEXT_PUBLIC_ROBINHOOD_DISTRIBUTOR_FACTORY_ADDRESS=0x834BEB67eA63d4246BD6B7D1928b2EBD57838F8c

NEXT_PUBLIC_ENABLE_ARC_CHAIN=true
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.mainnet.arc.io
NEXT_PUBLIC_ARC_WRAPPED_NATIVE_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_ARC_STABLE_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_ARC_STABLE_SYMBOL=USDC
NEXT_PUBLIC_ARC_FACTORY_ADDRESS=0xEfca26BAc433975a27E894eeD196C8a1D32c4beE
NEXT_PUBLIC_ARC_LOCKER_ADDRESS=0x01ec131cF83F2978780D969b79f4839090618187
NEXT_PUBLIC_ARC_DISTRIBUTOR_FACTORY_ADDRESS=0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726
```

The in-app docs page supports per-chain rendering through `?chain=bsc|base|robinhood|arc`.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
