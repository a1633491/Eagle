import { MarketHeader } from '@/components/market-header';
import { TokenPageContent } from '@/components/token-page-content';
import { getMarketOverview, getTokenDetail } from '@/lib/api';
import { normalizeLang } from '@/lib/i18n';

type TokenPageProps = {
  searchParams: Promise<{ address?: string; lang?: string }>;
};

export default async function TokenPage({ searchParams }: TokenPageProps) {
  const params = await searchParams;
  const lang = normalizeLang(params.lang);
  const overview = await getMarketOverview();
  const token = await getTokenDetail(params.address ?? overview.tokens[0].address);

  return (
    <div className='min-h-screen bg-[#151714]'>
      <MarketHeader overview={overview} />
      <main className='mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6'>
        <TokenPageContent lang={lang} token={token} />
      </main>
    </div>
  );
}
