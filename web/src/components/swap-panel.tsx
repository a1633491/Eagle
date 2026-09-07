'use client';

import { ArrowDownUp, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TokenDetail } from '@/lib/types';
import { currency } from '@/lib/format';
import { t, type Lang } from '@/lib/i18n';

export function SwapPanel({
  lang,
  token,
  creatorClaimableText,
}: {
  lang: Lang;
  token: TokenDetail;
  creatorClaimableText?: string;
}) {
  const [pay, setPay] = useState('0.00');
  const [slippage] = useState('0.5');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');

  const receive = useMemo(() => {
    const numericPay = Number(pay || 0);
    if (!numericPay || Number.isNaN(numericPay)) {
      return 0;
    }
    return side === 'Buy' ? numericPay / token.priceUsd : numericPay * token.priceUsd;
  }, [pay, side, token.priceUsd]);

  const paySymbol = side === 'Buy' ? token.quoteSymbol : token.symbol;
  const receiveSymbol = side === 'Buy' ? token.symbol : token.quoteSymbol;
  const receiveNote =
    side === 'Buy' ? `${currency(token.priceUsd)} / token` : `${currency(token.priceUsd)} per ${token.symbol}`;

  return (
    <div className="rounded-[22px] border border-white/10 bg-[#1b1d19]/95 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#f2ebd3]">{t(lang, 'swap')}</p>
          <p className="text-xs text-[#9da28f]">
            {t(lang, 'buyOrSellAgainst')} {token.quoteSymbol}
          </p>
        </div>
        <button type="button" className="rounded-full border border-white/10 p-2 text-[#a3a899] transition hover:text-[#f1e4b7]">
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-4 flex rounded-full border border-white/8 bg-[#131512] p-1 text-sm">
        <button
          type="button"
          onClick={() => setSide('Buy')}
          className={`flex-1 rounded-full px-3 py-2 transition ${side === 'Buy' ? 'bg-[#f7e8ba] text-[#342d1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]' : 'text-[#8f9482]'}`}
        >
          {t(lang, 'buy')}
        </button>
        <button
          type="button"
          onClick={() => setSide('Sell')}
          className={`flex-1 rounded-full px-3 py-2 transition ${side === 'Sell' ? 'bg-[#f7e8ba] text-[#342d1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]' : 'text-[#8f9482]'}`}
        >
          {t(lang, 'sell')}
        </button>
      </div>
      <SwapField
        label={t(lang, 'youPay')}
        symbol={paySymbol}
        value={pay}
        onChange={setPay}
        helper={t(lang, 'balance')}
      />
      <div className="mt-2 flex items-center gap-2 text-xs text-[#8f9482]">
        <span className="rounded-full border border-white/8 bg-[#131512] px-2.5 py-1">{t(lang, 'paired')}</span>
        <span className="rounded-full border border-white/8 bg-[#131512] px-2.5 py-1 text-[#cbd0c3]">25%</span>
        <span className="rounded-full border border-white/8 bg-[#131512] px-2.5 py-1 text-[#cbd0c3]">50%</span>
        <span className="rounded-full border border-white/8 bg-[#131512] px-2.5 py-1 text-[#cbd0c3]">75%</span>
      </div>
      <div className="my-3 flex justify-center">
        <div className="rounded-full border border-white/10 bg-[#131512] p-2 text-[#a3a899]">
          <ArrowDownUp className="h-4 w-4" />
        </div>
      </div>
      <SwapField
        label={t(lang, 'youReceive')}
        symbol={receiveSymbol}
        value={receive ? receive.toFixed(2) : '0.00'}
        helper={t(lang, 'estimated')}
        note={receiveNote}
        readOnly
      />
      <div className="mt-4 divide-y divide-white/6 overflow-hidden rounded-2xl border border-white/8 bg-[#131512] text-sm text-[#a8ad99]">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span>{t(lang, 'slippage')}</span>
          <span className="text-[#f3f1e8]">{slippage}%</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span>{t(lang, 'poolFee')}</span>
          <span className="text-[#f3f1e8]">1%</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span>{t(lang, 'creatorFee')}</span>
          <span className="text-[#f3f1e8]">1%</span>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-white/8 bg-[#131512] p-3 text-sm text-[#a8ad99]">
        <p className="text-[#f3f1e8]">{t(lang, 'creatorFees')}</p>
        <p className="mt-2">1% pool fee</p>
        <p className="mt-1">{t(lang, 'uncollectedFees')}</p>
        <p className="text-[#f3f1e8]">{creatorClaimableText ?? `0 ${token.quoteSymbol}`}</p>
        <p className="mt-1 text-xs text-[#8f9482]">{t(lang, 'beforeFeeSplit')} · {t(lang, 'live')}</p>
        <p className="mt-2">{t(lang, 'tokenSideFees')}</p>
        <p className="mt-1">{t(lang, 'creatorCollect')}</p>
      </div>
      <button
        type="button"
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-[#f6e3ac55] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] text-sm font-medium text-[#342d1a] transition hover:brightness-105"
      >
        {side === 'Buy' ? t(lang, 'buy') : t(lang, 'sell')}
      </button>
    </div>
  );
}

function SwapField({
  helper,
  label,
  note,
  onChange,
  readOnly,
  symbol,
  value,
}: {
  helper: string;
  label: string;
  note?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  symbol: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-[#131512] p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-[#8f9482]">
        <span>{label}</span>
        <span>{helper}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <input
          className="w-full bg-transparent text-2xl font-semibold text-[#f3f1e8] outline-none"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
        />
        <div className="rounded-full border border-white/10 bg-[#1b1d19] px-3 py-2 text-sm text-[#f3f1e8]">
          {symbol}
        </div>
      </div>
      {note ? <div className="mt-2 text-xs text-[#8f9482]">{note}</div> : null}
    </div>
  );
}
