import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { currency, numberCompact, percent, shorten } from '@/lib/format';
import { TokenSummary } from '@/lib/types';

export function TokenTable({ tokens }: { tokens: TokenSummary[] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/8 bg-[#1a1c19]/95">
      <table className="min-w-full text-left text-sm text-[#cad0c0]">
        <thead className="border-b border-white/8 bg-[#131512] text-xs uppercase tracking-wide text-[#8f9482]">
          <tr>
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">24h</th>
            <th className="px-4 py-3 font-medium">Market Cap</th>
            <th className="px-4 py-3 font-medium">Volume</th>
            <th className="px-4 py-3 font-medium">Holders</th>
            <th className="px-4 py-3 font-medium">Pool</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.address} className="border-b border-white/6 transition hover:bg-white/[0.025]">
              <td className="px-4 py-3">
                <Link href={`/token?address=${token.address}`} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8c48333] bg-[#ffffff06] font-semibold text-[#d1b773]">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#f3f1e8]">{token.name}</p>
                      {token.official ? (
                        <span className="rounded-full border border-[#e8d79f2f] bg-[#ffffff05] px-2 py-0.5 text-[10px] uppercase text-[#d8c483]">
                          Official
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#8f9482]">${token.symbol} · {shorten(token.address)}</p>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-[#f3f1e8]">{currency(token.priceUsd)}</td>
              <td className={`px-4 py-3 ${token.change24h >= 0 ? 'text-[#8fd19e]' : 'text-[#e28989]'}`}>
                {percent(token.change24h)}
              </td>
              <td className="px-4 py-3">{currency(token.marketCap)}</td>
              <td className="px-4 py-3">{currency(token.volume24h)}</td>
              <td className="px-4 py-3">{numberCompact(token.holders)}</td>
              <td className="px-4 py-3">
                <a
                  href={`https://bscscan.com/address/${token.poolAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#a3a899] transition hover:text-[#f1e4b7]"
                >
                  {shorten(token.poolAddress)}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
