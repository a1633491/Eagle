'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EagleMark } from '@/components/eagle-mark';
import { type ChainKey, withLangAndChain } from '@/lib/chains';
import { shorten } from '@/lib/format';
import { t, withLang, type Lang } from '@/lib/i18n';
import { getTokenImageUrl } from '@/lib/token-image';
import { TokenDetail } from '@/lib/types';

type ExploreTab = 'trending' | 'market-cap' | 'new';
const PINNED_OFFICIAL_TOKEN_ADDRESS = '0x281BF1DA0412B997ADA3aa38cf22001370E6e12F'.toLowerCase();

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

function pairBadge(token: TokenDetail) {
  return `${token.quoteSymbol}/${token.symbol}`;
}

function sortTokens<T extends { address: string }>(tokens: T[], compare: (left: T, right: T) => number) {
  return [...tokens].sort((left, right) => {
    const leftPinned = left.address.toLowerCase() === PINNED_OFFICIAL_TOKEN_ADDRESS;
    const rightPinned = right.address.toLowerCase() === PINNED_OFFICIAL_TOKEN_ADDRESS;
    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }
    return compare(left, right);
  });
}

export function HomeExploreTabs({
  lang,
  chainKey,
  query,
  tokens,
  trending,
}: {
  lang: Lang;
  chainKey: ChainKey;
  query?: string;
  tokens: TokenDetail[];
  trending: TokenDetail[];
}) {
  const [activeTab, setActiveTab] = useState<ExploreTab>('trending');

  const activeTokens = useMemo(() => {
    if (activeTab === 'market-cap') {
      return sortTokens(tokens, (a, b) => b.marketCap - a.marketCap);
    }
    if (activeTab === 'new') {
      return sortTokens(tokens, (a, b) => parseLaunchedAgo(a.launchedAgo) - parseLaunchedAgo(b.launchedAgo));
    }
    return sortTokens(trending, () => 0);
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
      <section className='grid grid-cols-2 gap-3 pt-4 sm:gap-5'>
        {visibleTokens.map((token) => (
          <Link
            key={token.address}
            href={withLangAndChain(`/token?address=${token.address}`, lang, chainKey)}
            aria-label={`${t(lang, 'explore')} ${token.name}`}
            className='flex min-h-0 w-full flex-col overflow-hidden rounded-[24px] border border-[#30352f] bg-[#161917] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-[#4a5147]'
          >
            <div
              className='relative flex aspect-square w-full items-center justify-center overflow-hidden border-b border-white/6 bg-[#1c211d]'
              style={tokenArtStyle(token)}
            >
              <div className='absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.24),rgba(255,255,255,0)_44%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.22))]' />
              <span className='absolute left-3 top-3 inline-flex items-center rounded-full border border-[#8f7a43]/40 bg-[#201d15]/88 px-2.5 py-1 text-[10px] font-medium leading-none text-[#efe0ac] shadow-[0_2px_8px_rgba(0,0,0,0.18)] sm:left-4 sm:top-4 sm:px-3'>
                {pairBadge(token)}
              </span>
              {getTokenImageUrl(token.metadataURI) ? (
                <img
                  src={getTokenImageUrl(token.metadataURI)}
                  alt={token.name}
                  className='relative h-full w-full object-cover'
                />
              ) : tokenArtType(token) === 0 ? (
                <EagleMark className='relative h-20 w-20 opacity-90 sm:h-24 sm:w-24' />
              ) : tokenArtType(token) === 1 ? (
                <div className='relative flex h-20 w-20 items-center justify-center rounded-full bg-[#fff7ea]/85 text-[1.8rem] font-semibold text-[#8a5d2b] shadow-[0_10px_30px_rgba(0,0,0,0.14)] sm:h-24 sm:w-24 sm:text-[2.2rem]'>
                  {tokenInitials(token)}
                </div>
              ) : (
                <div className='relative text-center'>
                  <div className='text-[3rem] leading-none text-white/90 sm:text-[3.4rem]'>◌</div>
                  <div className='-mt-4 text-[1.4rem] font-semibold tracking-[-0.08em] text-white/82 sm:-mt-5 sm:text-[1.65rem]'>
                    {tokenInitials(token)}
                  </div>
                </div>
              )}
            </div>
            <div className='flex min-h-[156px] flex-1 flex-col bg-[#121513] p-3.5 sm:min-h-[176px] sm:p-5'>
              <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
                <h2 className='truncate text-[0.95rem] font-semibold leading-6 tracking-[-0.03em] text-[#f3f1e8] sm:text-[1rem]'>
                  {token.name}
                </h2>
                {token.official ? (
                  <span className='inline-flex items-center gap-1 rounded-[14px] border border-[#857348] bg-[#2a281f] px-2 py-0.5 text-[10px] text-[#f0dfae] sm:px-2.5 sm:py-1 sm:text-[11px]'>
                    <span className='text-[10px]'>✦</span>
                    {t(lang, 'official')}
                  </span>
                ) : null}
              </div>
              <span className='mt-0.5 block text-[12px] leading-5 text-[#c5b47d] sm:mt-1 sm:text-[13px]'>${token.symbol}</span>
              <div className='mt-3 flex items-baseline justify-between gap-2 text-[#efe7c8] sm:mt-4'>
                <small className='text-[11px] text-[#8f9482] sm:text-[12px]'>{t(lang, 'mc')}</small>
                <strong className='text-[0.9rem] font-semibold sm:text-[0.98rem]'>{compactCurrency(token.marketCap)}</strong>
              </div>
              <div className='mt-1.5 flex items-baseline justify-between gap-2 text-[#d6d7cf] sm:mt-2.5'>
                <small className='text-[11px] text-[#8f9482] sm:text-[12px]'>{t(lang, 'vol')}</small>
                <span className='text-[12px] font-medium sm:text-[13px]'>{compactCurrency(token.volume24h)}</span>
              </div>
              <div className='mt-auto flex flex-col gap-1.5 pt-4 text-[11px] leading-5 text-[#8f9482] sm:pt-5 sm:text-[12px]'>
                <span className='truncate'>{shorten(token.address, 5, 4)}</span>
                <time dateTime={token.launchedAgo}>{token.launchedAgo}</time>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
