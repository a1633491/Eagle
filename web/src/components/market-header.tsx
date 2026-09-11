'use client';

import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EagleMark } from '@/components/eagle-mark';
import { getChainConfig, normalizeChainKey, type ChainKey } from '@/lib/chains';
import { MarketOverview } from '@/lib/types';
import { WalletStatus } from '@/components/wallet-status';
import { normalizeLang, t, type Lang } from '@/lib/i18n';

export function MarketHeader({ overview }: { overview: MarketOverview }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = normalizeLang(searchParams.get('lang') ?? undefined);
  const chainKey = normalizeChainKey(searchParams.get('chain') ?? undefined);
  const chain = getChainConfig(chainKey);

  const withLang = (href: string, nextLang = lang) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('lang', nextLang);
    params.set('chain', chainKey);
    const query = params.toString();
    return query ? `${href}?${query}` : href;
  };

  const switchLangHref = (nextLang: Lang) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('lang', nextLang);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const switchChainHref = (nextChain: ChainKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('chain', nextChain);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#151714]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[62px] w-full max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
        <Link href={withLang('/')} className="flex items-center gap-2.5 text-[#f4eed7]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8d79f2c] bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.14),rgba(255,255,255,0.03)_46%,rgba(10,12,10,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_8px_rgba(0,0,0,0.14)]">
            <EagleMark className="h-7 w-7" />
          </span>
          <span className="hidden text-[1.55rem] font-semibold tracking-[-0.07em] min-[380px]:inline">Eagle.</span>
        </Link>
        <div className="relative hidden h-10 items-center rounded-full border border-white/10 bg-white/[0.04] md:flex">
          <select
            aria-label="Network"
            value={chainKey}
            onChange={(event) => router.push(switchChainHref(event.target.value as ChainKey))}
            className="h-10 appearance-none rounded-full bg-transparent pl-3.5 pr-9 text-[12px] text-[#d2d5c9] outline-none"
          >
            <option value="bsc" className="bg-[#151714] text-[#f1e4b7]">
              BNB Chain
            </option>
            <option value="base" className="bg-[#151714] text-[#f1e4b7]">
              Base
            </option>
          </select>
          <ChevronDown className="h-4 w-4 text-[#a5aa99]" />
        </div>
        <nav className="ml-2 hidden items-center gap-4.5 text-[13px] text-[#a6aa99] md:flex">
          <Link href={withLang('/')} className="text-[#f1e4b7] transition hover:text-[#f1e4b7]">
            {t(lang, 'navExplore')}
          </Link>
          <Link href={withLang('/launch')} className="transition hover:text-[#f1e4b7]">
            {t(lang, 'navCreate')}
          </Link>
          <Link href={withLang('/my-tokens')} className="transition hover:text-[#f1e4b7]">
            {t(lang, 'navMyTokens')}
          </Link>
          <Link href={withLang('/docs')} className="transition hover:text-[#f1e4b7]">
            {t(lang, 'navDocs')}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04]">
            <select
              aria-label="Language"
              value={lang}
              onChange={(event) => router.push(switchLangHref(event.target.value as Lang))}
              className="h-10 appearance-none rounded-full bg-transparent pl-3 pr-8 text-[12px] text-[#f1e4b7] outline-none sm:pl-3.5 sm:pr-9"
            >
              <option value="en" className="bg-[#151714] text-[#f1e4b7]">
                EN
              </option>
              <option value="zh" className="bg-[#151714] text-[#f1e4b7]">
                中文
              </option>
              <option value="ja" className="bg-[#151714] text-[#f1e4b7]">
                日本語
              </option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-[#9da28f]" />
          </div>
          <div className="hidden h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-[#9da28f] lg:flex">
            <Search className="h-4 w-4" />
            {chain.shortName} · {t(lang, 'search')}
          </div>
          <WalletStatus />
        </div>
      </div>
    </header>
  );
}
