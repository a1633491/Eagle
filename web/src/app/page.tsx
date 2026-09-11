import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { HomeExploreTabs } from '@/components/home-explore-tabs';
import { MarketHeader } from '@/components/market-header';
import { getMarketOverview } from '@/lib/api';
import { normalizeChainKey, withLangAndChain } from '@/lib/chains';
import { normalizeLang, t, withLang } from '@/lib/i18n';

type HomePageProps = {
  searchParams: Promise<{ lang?: string; q?: string; chain?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const lang = normalizeLang(params.lang);
  const chainKey = normalizeChainKey(params.chain);
  const query = params.q?.trim() ?? '';
  const overview = await getMarketOverview(chainKey);

  return (
    <div className='min-h-screen bg-[#151714]'>
      <MarketHeader overview={overview} />
      <main className='mx-auto w-full max-w-[980px] px-4 pb-16 pt-4 sm:px-5'>
        <section className='mb-5 flex items-center gap-2 sm:gap-3'>
          <form action='/' className='flex-1'>
            <input type='hidden' name='lang' value={lang} />
            <input type='hidden' name='chain' value={chainKey} />
            <label className='flex h-13 items-center gap-3 rounded-full border border-[#3f443a] bg-[#1a1d18] px-5 text-[#cfd3c3] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus-within:border-[#5b624f]'>
              <Search className='h-4.5 w-4.5 text-[#8f9482]' />
              <input
                type='search'
                name='q'
                defaultValue={query}
                placeholder={t(lang, 'searchPlaceholder')}
                className='w-full bg-transparent text-[14px] text-[#f3f1e8] outline-none placeholder:text-[#7f8574]'
              />
            </label>
          </form>
          <Link
            href={withLangAndChain('/launch', lang, chainKey)}
            className='button primary launch-create-button'
          >
            <Plus className='h-4 w-4 shrink-0' />
            <span className='hidden sm:inline'>{t(lang, 'create')}</span>
          </Link>
        </section>
        <section className='mb-0.5'>
          <div className='flex flex-wrap items-end gap-2 sm:gap-3'>
            <h1 className='text-[1.9rem] font-semibold tracking-[-0.065em] text-[#f4eed7] sm:text-[2.35rem]'>{t(lang, 'explore')}</h1>
            <span className='pb-1 text-[12px] leading-5 text-[#8f9482]'>
              {overview.launchedCount} {t(lang, 'launchedSuffix')}
            </span>
          </div>
        </section>
        <HomeExploreTabs tokens={overview.tokens} trending={overview.trending} lang={lang} chainKey={chainKey} query={query} />
      </main>
    </div>
  );
}
