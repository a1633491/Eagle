import Link from 'next/link';
import { MarketHeader } from '@/components/market-header';
import { MyTokensContent } from '@/components/my-tokens-content';
import { getMarketOverview } from '@/lib/api';
import { normalizeChainKey, withLangAndChain } from '@/lib/chains';
import { normalizeLang, t } from '@/lib/i18n';

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

        <MyTokensContent lang={lang} chainKey={chainKey} tokens={overview.tokens} />
      </main>
    </div>
  );
}
