import { MarketHeader } from '@/components/market-header';
import { LaunchBuilder } from '@/components/launch-builder';
import { getMarketOverview } from '@/lib/api';
import { normalizeLang } from '@/lib/i18n';

type LaunchPageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export default async function LaunchPage({ searchParams }: LaunchPageProps) {
  const params = await searchParams;
  const lang = normalizeLang(params.lang);
  const overview = await getMarketOverview();

  return (
    <div className='min-h-screen bg-[#151714]'>
      <MarketHeader overview={overview} />
      <main className='mx-auto w-full max-w-6xl px-4 py-6 lg:px-6'>
        <LaunchBuilder lang={lang} />
      </main>
    </div>
  );
}
