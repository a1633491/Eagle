## Eagle Web

Frontend for the Eagle market, launch, and wallet flows.

### Robinhood / Uni v4 envs

To expose the Robinhood chain switch in the UI, set at minimum:

```bash
NEXT_PUBLIC_ENABLE_ROBINHOOD_CHAIN=true
NEXT_PUBLIC_ROBINHOOD_RPC_URL=https://robinhood.drpc.org
NEXT_PUBLIC_ROBINHOOD_WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
```

Robinhood public RPCs can vary by region. The frontend now prefers `https://robinhood.drpc.org` by default.

For the current preview flow, these are also recommended:

```bash
NEXT_PUBLIC_ROBINHOOD_STABLE_TOKEN_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
NEXT_PUBLIC_ROBINHOOD_FACTORY_ADDRESS=0x45885Af25A1dF74f90B995A0aD1DF5623Ee22Ad7
NEXT_PUBLIC_ROBINHOOD_LOCKER_ADDRESS=0x84BF96173F410F08Be868F53ACbE42B8d269e508
NEXT_PUBLIC_ROBINHOOD_DISTRIBUTOR_FACTORY_ADDRESS=<optional-placeholder>
NEXT_PUBLIC_ROBINHOOD_V4_POOL_MANAGER=0x8366a39CC670B4001A1121B8F6A443A643e40951
NEXT_PUBLIC_ROBINHOOD_V4_UNIVERSAL_ROUTER=0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99
NEXT_PUBLIC_ROBINHOOD_V4_QUOTER=0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94
NEXT_PUBLIC_ROBINHOOD_V4_STATE_VIEW=0xF3334192D15450CdD385c8B70e03f9A6bD9E673b
NEXT_PUBLIC_ROBINHOOD_V4_PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3
```

The Robinhood token detail page now uses the Worker to proxy Uni v4 quote / approval / swap building, so `NEXT_PUBLIC_API_BASE_URL` must point at the Worker deployment.

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
