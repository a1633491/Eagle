## Eagle Web

Frontend for the Eagle market, launch, and wallet flows.

### Robinhood envs

To expose the Robinhood chain switch in the UI, set at minimum:

```bash
NEXT_PUBLIC_ENABLE_ROBINHOOD_CHAIN=true
NEXT_PUBLIC_ROBINHOOD_RPC_URL=https://robinhood.drpc.org
NEXT_PUBLIC_ROBINHOOD_WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
```

Robinhood public RPCs can vary by region. The frontend now prefers `https://robinhood.drpc.org` by default.

For Robinhood launches using the Brew suite on top of Uni v3, these are also recommended:

```bash
NEXT_PUBLIC_ROBINHOOD_STABLE_TOKEN_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
NEXT_PUBLIC_ROBINHOOD_FACTORY_ADDRESS=0xA1821b220716cE0bADb708Cd7A507D791f83437a
NEXT_PUBLIC_ROBINHOOD_LOCKER_ADDRESS=0xf14Bc7e40Db50D5655957EFE87cB6f20d11AE872
NEXT_PUBLIC_ROBINHOOD_DISTRIBUTOR_FACTORY_ADDRESS=0xaE62EE1fb7Db56Db5ef7DeC817E573b3DDE0Af23
```

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
