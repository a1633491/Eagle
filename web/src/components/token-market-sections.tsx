'use client';

import { ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { currency } from '@/lib/format';
import { t, type Lang } from '@/lib/i18n';
import { TokenDetail } from '@/lib/types';
import { TokenPriceChart } from '@/components/token-price-chart';

type QuoteMode = 'usd' | 'quote';
type RangeMode = '1H' | '6H' | '1D' | '7D' | 'ALL';
type ActivityMode = 'activity' | 'holders' | 'all-trades';
type TradeFilter = 'all' | 'buys' | 'sells';

function getVisibleChart(token: TokenDetail, range: RangeMode, quoteMode: QuoteMode) {
  const total = token.chart.length;
  const rangeMap: Record<RangeMode, number> = {
    '1H': Math.max(12, Math.floor(total * 0.2)),
    '6H': Math.max(20, Math.floor(total * 0.4)),
    '1D': Math.max(30, Math.floor(total * 0.65)),
    '7D': Math.max(40, Math.floor(total * 0.85)),
    ALL: total,
  };

  const sliced = token.chart.slice(-rangeMap[range]);
  if (quoteMode === 'usd') return sliced;

  const divisor = token.priceUsd || 1;
  return sliced.map((point) => ({
    ...point,
    value: point.value / divisor,
  }));
}

export function TokenMarketSections({ lang, token }: { lang: Lang; token: TokenDetail }) {
  const [quoteMode, setQuoteMode] = useState<QuoteMode>('usd');
  const [rangeMode, setRangeMode] = useState<RangeMode>('ALL');
  const [activityMode, setActivityMode] = useState<ActivityMode>('all-trades');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');

  const chartData = useMemo(() => getVisibleChart(token, rangeMode, quoteMode), [token, rangeMode, quoteMode]);

  const trades = useMemo(() => {
    if (tradeFilter === 'buys') {
      return token.trades.filter((trade) => trade.type === 'Buy');
    }
    if (tradeFilter === 'sells') {
      return token.trades.filter((trade) => trade.type === 'Sell');
    }
    return token.trades;
  }, [token.trades, tradeFilter]);

  const topTabs: Array<{ id: ActivityMode; label: string }> = [
    { id: 'activity', label: t(lang, 'activity') },
    { id: 'holders', label: t(lang, 'holders') },
    { id: 'all-trades', label: t(lang, 'allTrades') },
  ];

  const tradeTabs: Array<{ id: TradeFilter; label: string }> = [
    { id: 'all', label: t(lang, 'allTrades') },
    { id: 'buys', label: t(lang, 'buys') },
    { id: 'sells', label: t(lang, 'sells') },
  ];

  return (
    <>
      <div className='rounded-[24px] border border-white/8 bg-[#1a1c19]/96 p-4 sm:p-5'>
        <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-[13px] text-[#8f9482]'>
              {quoteMode === 'usd' ? 'USD' : token.quoteSymbol} · {t(lang, 'marketHistory')}
            </p>
            <h2 className='text-xl font-semibold text-[#f3f1e8]'>{t(lang, 'live')}</h2>
          </div>
          <div className='rounded-full border border-white/10 bg-[#131512] px-3 py-2 text-xs text-[#a3a899]'>{t(lang, 'updated')}</div>
        </div>
        <div className='mb-4 flex flex-wrap items-center gap-1.5 text-xs text-[#8f9482]'>
          <button
            type='button'
            onClick={() => setQuoteMode('usd')}
            className={`rounded-full border px-2.5 py-1 ${quoteMode === 'usd' ? 'border-[#e8d79f2f] bg-[#ffffff05] text-[#f1e4b7]' : 'border-white/8 bg-[#131512]'}`}
          >
            USD
          </button>
          <button
            type='button'
            onClick={() => setQuoteMode('quote')}
            className={`rounded-full border px-2.5 py-1 ${quoteMode === 'quote' ? 'border-[#e8d79f2f] bg-[#ffffff05] text-[#f1e4b7]' : 'border-white/8 bg-[#131512]'}`}
          >
            {token.quoteSymbol}
          </button>
          {(['1H', '6H', '1D', '7D', 'ALL'] as RangeMode[]).map((range) => (
            <button
              key={range}
              type='button'
              onClick={() => setRangeMode(range)}
              className={`rounded-full border px-2.5 py-1 ${rangeMode === range ? 'ml-1 border-[#e8d79f2f] bg-[#ffffff05] text-[#f1e4b7]' : 'border-white/8 bg-[#131512]'}`}
            >
              {range}
            </button>
          ))}
        </div>
        <TokenPriceChart data={chartData} />
      </div>

      <div className='rounded-[24px] border border-white/8 bg-[#1a1c19]/96 p-4 sm:p-5'>
        <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-wrap items-center gap-4 border-b border-white/8 pb-2.5 text-[13px]'>
            {topTabs.map((tab) => (
              <button
                key={tab.id}
                type='button'
                onClick={() => setActivityMode(tab.id)}
                className={activityMode === tab.id ? 'text-[#cfd3c3]' : 'text-[#8f9482]'}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className='inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-[#131512] px-3 py-2 text-xs text-[#a3a899] sm:self-auto'>
            <ShieldCheck className='h-4 w-4 text-[#d8c483]' />
            {t(lang, 'liveSample')}
          </div>
        </div>

        {activityMode === 'holders' ? (
          <div className='rounded-[18px] border border-white/8 bg-[#131512] px-4 py-5 text-sm text-[#9da28f]'>
            {t(lang, 'catchingUp')}
          </div>
        ) : (
          <>
            <div className='mb-4 flex flex-wrap items-center gap-2 text-[13px]'>
              {tradeTabs.map((tab) => (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => setTradeFilter(tab.id)}
                  className={`rounded-full border px-3 py-1.5 ${
                    tradeFilter === tab.id
                      ? 'border-[#e8d79f2f] bg-[#ffffff05] text-[#f1e4b7]'
                      : 'border-white/8 bg-[#131512] text-[#8f9482]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className='overflow-x-auto rounded-[18px] border border-white/8'>
              <table className='min-w-[720px] text-left text-[12px] text-[#cbd0c3]'>
                <thead className='bg-[#131512] text-xs uppercase tracking-wide text-[#8f9482]'>
                  <tr>
                    <th className='px-4 py-3 font-medium'>{t(lang, 'time')}</th>
                    <th className='px-4 py-3 font-medium'>{t(lang, 'type')}</th>
                    <th className='px-4 py-3 font-medium'>{token.symbol}</th>
                    <th className='px-4 py-3 font-medium'>{t(lang, 'amountUsd')}</th>
                    <th className='px-4 py-3 font-medium'>{t(lang, 'sender')}</th>
                    <th className='px-4 py-3 font-medium'>{t(lang, 'price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className='border-t border-white/6 hover:bg-white/[0.025]'>
                      <td className='px-4 py-2'>{trade.time}</td>
                      <td className={`px-4 py-2 ${trade.type === 'Buy' ? 'text-[#8fd19e]' : 'text-[#e28989]'}`}>
                        {trade.type === 'Buy' ? t(lang, 'buy') : t(lang, 'sell')}
                      </td>
                      <td className='px-4 py-2'>{trade.amountToken.toLocaleString('en-US')}</td>
                      <td className='px-4 py-2'>{currency(trade.amountUsd)}</td>
                      <td className='px-4 py-2'>{trade.sender}</td>
                      <td className='px-4 py-2'>{currency(trade.priceUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
