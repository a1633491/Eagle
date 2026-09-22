'use client';

import { Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { type ChainKey, withLangAndChain } from '@/lib/chains';
import { shorten } from '@/lib/format';
import { type Lang } from '@/lib/i18n';
import { TokenTable } from '@/components/token-table';
import { type TokenDetail } from '@/lib/types';

const copy = {
  zh: {
    sectionEyebrow: '已创建代币',
    sectionTitle: '这里展示当前钱包创建的代币',
    sectionHint: '只显示当前链上由你作为创建者发射的代币。',
    connectTitle: '连接钱包后查看你创建的代币',
    connectHint: '连接当前创建代币的钱包地址后，这里会自动列出你已发射的项目。',
    connectButton: '连接钱包',
    emptyTitle: '这个钱包还没有已创建代币',
    emptyHint: '切换到创建过代币的钱包，或直接去创建一个新的代币。',
    createdCount: '已创建',
    createToken: '创建代币',
  },
  en: {
    sectionEyebrow: 'Created tokens',
    sectionTitle: 'Tokens created by this wallet',
    sectionHint: 'This page only shows launches on the current chain where you are the creator.',
    connectTitle: 'Connect your wallet to see your created tokens',
    connectHint: 'After connecting the wallet that launched a token, your projects will appear here automatically.',
    connectButton: 'Connect wallet',
    emptyTitle: 'No created tokens for this wallet yet',
    emptyHint: 'Switch to the wallet that launched a token, or create a new token now.',
    createdCount: 'Created',
    createToken: 'Create token',
  },
  ja: {
    sectionEyebrow: '作成済みトークン',
    sectionTitle: 'このウォレットが作成したトークン',
    sectionHint: '現在のチェーンで、あなたが作成者としてローンチしたトークンだけを表示します。',
    connectTitle: 'ウォレットを接続して作成済みトークンを見る',
    connectHint: 'トークンをローンチしたウォレットを接続すると、ここに自動で表示されます。',
    connectButton: 'ウォレットを接続',
    emptyTitle: 'このウォレットには作成済みトークンがありません',
    emptyHint: 'トークンを作成したウォレットに切り替えるか、新しいトークンを作成してください。',
    createdCount: '作成数',
    createToken: 'トークンを作成',
  },
} as const;

export function MyTokensContent({
  lang,
  chainKey,
  tokens,
}: {
  lang: Lang;
  chainKey: ChainKey;
  tokens: TokenDetail[];
}) {
  const locale = copy[lang];
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const primaryConnector = connectors[0];

  const createdTokens = useMemo(() => {
    if (!address) return [];
    const normalized = address.toLowerCase();
    return tokens.filter((token) => token.creator.toLowerCase() === normalized);
  }, [address, tokens]);

  return (
    <section className='mt-14 rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] sm:p-6'>
      <p className='text-[11px] font-medium uppercase tracking-[0.2em] text-[#8f9482]'>{locale.sectionEyebrow}</p>
      <h2 className='mt-3 text-[1.5rem] font-semibold tracking-[-0.05em] text-[#f3f1e8] sm:text-[1.8rem]'>{locale.sectionTitle}</h2>
      <p className='mt-3 max-w-2xl text-[14px] leading-7 text-[#a8ad99]'>{locale.sectionHint}</p>

      {!isConnected || !address ? (
        <div className='mt-6 rounded-[22px] border border-white/8 bg-[#131512] p-5 text-center sm:p-8'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#e8d79f2f] bg-[#ffffff08] text-[#dbc27a]'>
            <Wallet className='h-5 w-5' />
          </div>
          <h3 className='mt-4 text-lg font-semibold text-[#f3f1e8]'>{locale.connectTitle}</h3>
          <p className='mt-2 text-sm leading-6 text-[#8f9482]'>{locale.connectHint}</p>
          <button
            type='button'
            onClick={() => primaryConnector && connect({ connector: primaryConnector })}
            disabled={!primaryConnector || isPending}
            className='mt-5 inline-flex h-10 items-center rounded-full border border-[#f6e3ac66] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] px-5 text-sm font-medium text-[#342d1a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isPending ? 'Connecting...' : locale.connectButton}
          </button>
        </div>
      ) : createdTokens.length === 0 ? (
        <div className='mt-6 rounded-[22px] border border-white/8 bg-[#131512] p-5 sm:p-8'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-xs uppercase tracking-[0.18em] text-[#8f9482]'>{shorten(address)}</p>
              <h3 className='mt-2 text-lg font-semibold text-[#f3f1e8]'>{locale.emptyTitle}</h3>
              <p className='mt-2 text-sm leading-6 text-[#8f9482]'>{locale.emptyHint}</p>
            </div>
            <a
              href={withLangAndChain('/launch', lang, chainKey)}
              className='inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-[#f1e4b7] transition hover:bg-white/[0.06]'
            >
              {locale.createToken}
            </a>
          </div>
        </div>
      ) : (
        <div className='mt-6 space-y-4'>
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-[#131512] px-4 py-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.18em] text-[#8f9482]'>{shorten(address)}</p>
              <p className='mt-1 text-sm text-[#f3f1e8]'>
                {locale.createdCount}: <span className='font-semibold text-[#f1e4b7]'>{createdTokens.length}</span>
              </p>
            </div>
          </div>
          <TokenTable tokens={createdTokens} lang={lang} chainKey={chainKey} />
        </div>
      )}
    </section>
  );
}
