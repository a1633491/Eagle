'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EagleMark } from '@/components/eagle-mark';
import { shorten } from '@/lib/format';
import { t, withLang, type Lang } from '@/lib/i18n';
import { getTokenImageUrl } from '@/lib/token-image';
import { TokenDetail } from '@/lib/types';

type ExploreTab = 'trending' | 'market-cap' | 'new';

function parseLaunchedAgo(value: string) {
  const match = value.match(/(\d+)\s*(min|hr|day)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'min') return amount;
  if (unit === 'hr') return amount * 60;
  return amount * 60 * 24;
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function tokenArtStyle(token: TokenDetail) {
  const palettes = [
    ['#f3f4f0', '#d6dccf', '#6b7567'],
    ['#faf3dc', '#d8c588', '#726341'],
    ['#e7eef7', '#aebfd3', '#5d6a79'],
    ['#f4ebe6', '#c8aaa0', '#715d56'],
    ['#eef0df', '#bac697', '#65704d'],
  ] as const;
  const key = token.symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [from, via, to] = palettes[key % palettes.length];
  return {
    background: `linear-gradient(145deg, ${from}, ${via} 52%, ${to})`,
  };
}

function tokenInitials(token: TokenDetail) {
  return token.symbol.slice(0, 2);
}

function tokenArtType(token: TokenDetail) {
  const key = token.symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return key % 3;
}

export function HomeExploreTabs({
  lang,
  query,
  tokens,
  trending,
}: {
  lang: Lang;
  query?: string;
  tokens: TokenDetail[];
  trending: TokenDetail[];
}) {
  const [activeTab, setActiveTab] = useState<ExploreTab>('trending');

  const activeTokens = useMemo(() => {
    if (activeTab === 'market-cap') {
      return [...tokens].sort((a, b) => b.marketCap - a.marketCap);
    }
    if (activeTab === 'new') {
      return [...tokens].sort((a, b) => parseLaunchedAgo(a.launchedAgo) - parseLaunchedAgo(b.launchedAgo));
    }
    return trending;
  }, [activeTab, tokens, trending]);

  const visibleTokens = useMemo(() => {
    const keyword = query?.trim().toLowerCase();
    if (!keyword) return activeTokens;

    return activeTokens.filter((token) => {
      const haystacks = [token.name, token.symbol, token.address, token.quoteSymbol, token.pairLabel];
      return haystacks.some((value) => value.toLowerCase().includes(keyword));
    });
  }, [activeTokens, query]);

  const tabs: Array<{ id: ExploreTab; label: string }> = [
    { id: 'trending', label: t(lang, 'trending') },
    { id: 'market-cap', label: t(lang, 'marketCap') },
    { id: 'new', label: t(lang, 'new') },
  ];

  return (
    <>
      <div className='mt-2 flex items-center gap-3.5 border-b border-white/8 pb-2 text-[12.5px]'>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type='button'
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'font-medium text-[#f1e4b7]' : 'text-[#8f9482] transition hover:text-[#f1e4b7]'}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section className='grid grid-cols-2 gap-6 pt-3 max-[720px]:grid-cols-1'>
        {visibleTokens.map((token) => (
          <Link
            key={token.address}
            href={withLang(`/token?address=${token.address}`, lang)}
            aria-label={`${t(lang, 'explore')} ${token.name}`}
            className='flex min-h-0 w-full flex-col overflow-hidden rounded-[32px] border border-[#43473d] bg-[linear-gradient(180deg,#1a1d18,#171916_55%,#151714)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#555b4b]'
          >
            <div
              className='relative flex aspect-square w-full items-center justify-center overflow-hidden border-b border-white/6'
              style={tokenArtStyle(token)}
            >
              <div className='absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.42),rgba(255,255,255,0)_46%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.18))]' />
              <span className='absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#61533d] px-3 py-2 text-[11px] leading-none text-[#f2e5bb] shadow-[0_2px_8px_rgba(0,0,0,0.16)]'>
                <span>◆</span>
                {token.quoteSymbol}
              </span>
              {getTokenImageUrl(token.metadataURI) ? (
            <div
                  className='relative h-24 w-24 overflow-hidden rounded-full border border-white/15 shadow-[0_14px_40px_rgba(0,0,0,0.28)]'
            >
                <img
                    src={getTokenImageUrl(token.metadataURI)}
                  alt={token.name}
                    className='h-full w-full object-cover'
                />
                </div>
              ) : tokenArtType(token) === 0 ? (
                <EagleMark className='relative h-20 w-20 opacity-95' />
              ) : tokenArtType(token) === 1 ? (
                <div className='relative flex h-20 w-20 items-center justify-center rounded-full bg-[#fff7ea]/85 text-[2rem] font-semibold text-[#8a5d2b] shadow-[0_10px_30px_rgba(0,0,0,0.14)]'>
                  {tokenInitials(token)}
                </div>
              ) : (
                <div className='relative text-center'>
                  <div className='text-[3.4rem] leading-none text-white/90'>◌</div>
                  <div className='-mt-5 text-[1.65rem] font-semibold tracking-[-0.08em] text-white/82'>{tokenInitials(token)}</div>
                </div>
              )}
            </div>
            <div className='flex min-h-[176px] flex-1 flex-col p-5'>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 className='text-[1rem] font-semibold leading-6 tracking-[-0.03em] text-[#f3f1e8]'>{token.name}</h2>
                {token.official ? (
                  <span className='inline-flex items-center gap-1 rounded-[14px] border border-[#857348] bg-[#2a281f] px-2.5 py-1 text-[11px] text-[#f0dfae]'>
                    <span className='text-[10px]'>✦</span>
                    {t(lang, 'official')}
                  </span>
                ) : null}
              </div>
              <span className='mt-1 block text-[13px] leading-5 text-[#b9bdae]'>${token.symbol}</span>
              <div className='mt-4 flex items-baseline gap-1 text-[#efe7c8]'>
                <strong className='text-[0.98rem] font-semibold'>{compactCurrency(token.marketCap)}</strong>
                <small className='text-[12px] text-[#9ca08d]'>{t(lang, 'mc')}</small>
              </div>
              <div className='mt-2.5 flex items-baseline gap-1 text-[#aeb3a3]'>
                <span className='text-[13px] font-medium'>{compactCurrency(token.volume24h)}</span>
                <small className='text-[12px] text-[#8f9482]'>{t(lang, 'vol')}</small>
              </div>
              <div className='mt-auto flex items-center justify-between gap-3 pt-5 text-[12px] leading-5 text-[#8f9482]'>
                <span>{shorten(token.address)}</span>
                <time dateTime={token.launchedAgo}>{token.launchedAgo}</time>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
