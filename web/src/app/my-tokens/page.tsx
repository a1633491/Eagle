import Link from 'next/link';
import { MarketHeader } from '@/components/market-header';
import { getMarketOverview } from '@/lib/api';
import { normalizeChainKey, withLangAndChain } from '@/lib/chains';
import { normalizeLang, t, withLang } from '@/lib/i18n';

type MyTokensPageProps = {
  searchParams: Promise<{ lang?: string; chain?: string }>;
};

export default async function MyTokensPage({ searchParams }: MyTokensPageProps) {
  const params = await searchParams;
  const lang = normalizeLang(params.lang);
  const chainKey = normalizeChainKey(params.chain);
  const overview = await getMarketOverview(chainKey);

  return (
    <div className='min-h-screen bg-[#151714]'>
      <MarketHeader overview={overview} />
      <main className='mx-auto flex w-full max-w-[760px] flex-col px-4 pb-16 pt-12'>
        <section className='flex flex-col items-center text-center'>
          <p className='text-[11px] font-medium uppercase tracking-[0.24em] text-[#9da28f]'>{t(lang, 'yourIdeasLiveHere')}</p>
          <h1 className='mt-4 text-[2rem] font-semibold tracking-[-0.065em] text-[#f3f1e8] sm:text-[2.55rem]'>{t(lang, 'somethingBrewing')}</h1>
          <p className='mt-3 max-w-xl text-[1rem] leading-7 text-[#a8ad99]'>
            {t(lang, 'pickUp')}
          </p>
          <Link
            href={withLangAndChain('/launch', lang, chainKey)}
            className='mt-6 inline-flex h-10 items-center rounded-full border border-[#f6e3ac66] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] px-5 text-sm font-medium text-[#342d1a] transition hover:brightness-105'
          >
            {t(lang, 'newToken')}
          </Link>
        </section>

        <section className='mt-14 rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] sm:p-6'>
          <p className='text-[11px] font-medium uppercase tracking-[0.2em] text-[#8f9482]'>{t(lang, 'create')}</p>
          <h2 className='mt-3 text-[1.5rem] font-semibold tracking-[-0.05em] text-[#f3f1e8] sm:text-[1.8rem]'>{t(lang, 'yourFirstIdea')}</h2>
          <p className='mt-3 max-w-2xl text-[14px] leading-7 text-[#a8ad99]'>
            {t(lang, 'createDraft')}
          </p>
          <Link
            href={withLangAndChain('/launch', lang, chainKey)}
            className='mt-6 inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-[#f1e4b7] transition hover:bg-white/[0.06]'
          >
            {t(lang, 'createFirstToken')}
          </Link>
          <p className='mt-5 text-xs leading-6 text-[#8f9482]'>
            {t(lang, 'draftsSaved')}
          </p>
        </section>
      </main>
    </div>
  );
}
