'use client';

import { Wallet } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shorten } from '@/lib/format';

export function WalletStatus() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const primaryConnector = connectors[0];

  if (isConnected && address) {
    return (
      <button
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e8d79f2f] bg-[#ffffff08] px-3 text-[13px] text-[#f1e4b7] transition hover:bg-[#ffffff0c] sm:px-4"
        onClick={() => disconnect()}
        type="button"
      >
        <Wallet className="h-4 w-4 text-[#dbc27a]" />
        <span className="hidden min-[380px]:inline">{shorten(address)}</span>
      </button>
    );
  }

  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-full border border-[#f6e3ac66] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] px-3 text-[13px] font-medium text-[#342d1a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
      onClick={() => primaryConnector && connect({ connector: primaryConnector })}
      type="button"
      disabled={!primaryConnector || isPending}
    >
      <Wallet className="h-4 w-4" />
      <span className="hidden min-[380px]:inline">{isPending ? 'Connecting...' : 'Connect Wallet'}</span>
    </button>
  );
}
