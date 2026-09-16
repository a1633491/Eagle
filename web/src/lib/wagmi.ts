import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { base, bsc } from 'wagmi/chains';
import { arcChain, arcPublicRpcUrl } from '@/lib/arc';
import { robinhoodChain, robinhoodPublicRpcUrl } from '@/lib/robinhood-v4';

export const wagmiConfig = createConfig({
  chains: [arcChain, bsc, base, robinhoodChain],
  connectors: [injected()],
  transports: {
    [arcChain.id]: http(arcPublicRpcUrl),
    [bsc.id]: http(),
    [base.id]: http(),
    [robinhoodChain.id]: http(robinhoodPublicRpcUrl),
  },
  ssr: true,
});

export const queryClient = new QueryClient();
