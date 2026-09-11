import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { base, bsc } from 'wagmi/chains';

export const wagmiConfig = createConfig({
  chains: [bsc, base],
  connectors: [injected()],
  transports: {
    [bsc.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});

export const queryClient = new QueryClient();
