import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { base, bsc } from 'wagmi/chains';
import { robinhoodChain, robinhoodPublicRpcUrl } from '@/lib/robinhood-v4';

export const wagmiConfig = createConfig({
  chains: [bsc, base, robinhoodChain],
  connectors: [injected()],
  transports: {
    [bsc.id]: http(),
    [base.id]: http(),
    [robinhoodChain.id]: http(robinhoodPublicRpcUrl),
  },
  ssr: true,
});

export const queryClient = new QueryClient();
