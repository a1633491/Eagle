import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { base, bsc } from 'wagmi/chains';
import { arcChain, arcPublicRpcUrl } from '@/lib/arc';
import { robinhoodChain, robinhoodPublicRpcUrl } from '@/lib/robinhood-v4';

export const wagmiConfig = createConfig({
  chains: [bsc, base, robinhoodChain, arcChain],
  connectors: [injected()],
  transports: {
    [bsc.id]: http(),
    [base.id]: http(),
    [robinhoodChain.id]: http(robinhoodPublicRpcUrl),
    [arcChain.id]: http(arcPublicRpcUrl),
  },
  ssr: true,
});

export const queryClient = new QueryClient();
