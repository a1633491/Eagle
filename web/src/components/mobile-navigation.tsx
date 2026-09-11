'use client';

import Link from 'next/link';
import { BookOpen, Compass, Plus, Wallet } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { normalizeChainKey, withLangAndChain } from '@/lib/chains';
import { normalizeLang, t, withLang } from '@/lib/i18n';

export function MobileNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = normalizeLang(searchParams.get('lang') ?? undefined);
  const chainKey = normalizeChainKey(searchParams.get('chain') ?? undefined);
  const items = [
    { href: '/', label: t(lang, 'navExplore'), icon: Compass },
    { href: '/launch', label: t(lang, 'navCreate'), icon: Plus, emphasize: true },
    { href: '/my-tokens', label: t(lang, 'navMyTokens'), icon: Wallet },
    { href: '/docs', label: t(lang, 'navDocs'), icon: BookOpen },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto grid w-[min(460px,calc(100%-20px))] grid-cols-4 rounded-[22px] border border-[#e8d79f26] bg-[linear-gradient(145deg,#292b23ed,#161813f2)] p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.5)] md:hidden">
      {items.map(({ emphasize, href, icon: Icon, label }) => {
        const active = pathname === href;

        return (
          <Link
            key={href}
            href={withLangAndChain(href, lang, chainKey)}
            className={`relative flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[16px] px-2 py-2 text-[11px] transition ${
              active ? 'text-[#f1e4b7]' : 'text-[#a3a899]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-[12px] ${
                emphasize
                  ? 'border border-[#ffefba8c] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] text-[#342d1a] shadow-[0_4px_14px_rgba(222,195,124,0.17)]'
                  : active
                    ? 'bg-[#e4d39a0e]'
                    : ''
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>{label}</span>
            {active ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#e8ce83]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
