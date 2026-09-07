import { MarketOverview, TokenDetail } from '@/lib/types';

const baseChart = [
  0.0108, 0.0112, 0.0118, 0.0125, 0.0131, 0.0127, 0.0136, 0.0144, 0.0153,
  0.0162, 0.0175, 0.0181, 0.0178, 0.0185, 0.0189, 0.0183, 0.0191, 0.0186,
  0.0189, 0.0194,
];

const makeChart = (start: number) =>
  baseChart.map((value, index) => ({
    time: start + index * 3600,
    value,
  }));

export const tokenDetails: TokenDetail[] = [
  {
    address: '0xfa6d9b504848606eb9aec04ccc161d169b3f2159',
    name: 'EAGLE',
    symbol: 'EAGLE',
    quoteSymbol: 'WBNB',
    priceUsd: 0.0185,
    change24h: 208060,
    marketCap: 18520000,
    volume24h: 41710000,
    liquidity: 2860000,
    holders: 1428,
    launchedAgo: '19 hr ago',
    description: 'Launch tokens with your favorite memecoins, coins or stocks on BNB Chain.',
    creator: '0x97b8240cf6e1b36a2dac7a555969b00d529786f8',
    poolAddress: '0x3ea3f9a7b7edbfe0ba3568bfc0f30ba870b7553d',
    official: true,
    tags: ['Official', 'Hot', 'Verified'],
    totalSupply: '1,000M EAGLE',
    launchedDate: 'Sep 6, 2026',
    pairLabel: 'EAGLE / WBNB',
    chart: makeChart(1725561600),
    trades: [
      { id: 't-1', time: '2s ago', type: 'Buy', amountToken: 516.217, amountUsd: 9.65853, sender: '0xa67d...3fbb', priceUsd: 0.01871 },
      { id: 't-2', time: '3s ago', type: 'Sell', amountToken: 17260, amountUsd: 316.786, sender: '0x7793...dd27', priceUsd: 0.01835 },
      { id: 't-3', time: '4s ago', type: 'Sell', amountToken: 174910, amountUsd: 3240, sender: '0x4337...bc7a', priceUsd: 0.0185 },
      { id: 't-4', time: '4s ago', type: 'Buy', amountToken: 52210, amountUsd: 991.261, sender: '0xa5a5...a142', priceUsd: 0.01898 },
      { id: 't-5', time: '5s ago', type: 'Buy', amountToken: 5230, amountUsd: 99.0708, sender: '0x56c2...8a8b', priceUsd: 0.01892 },
    ],
  },
  {
    address: '0x8519a83aec3e38f7609b1e767c3e0eeb54f47bb6',
    name: 'Dust Astherus',
    symbol: 'DUST',
    quoteSymbol: 'ASTER',
    priceUsd: 0.0031,
    change24h: 182.4,
    marketCap: 30100,
    volume24h: 231060,
    liquidity: 8620,
    holders: 311,
    launchedAgo: '4 hr ago',
    description: 'Experimental launch flowing through the Eagle discovery stream.',
    creator: '0x1226240cf6e1b36a2dac7a555969b00d52971234',
    poolAddress: '0x1ea3f9a7b7edbfe0ba3568bfc0f30ba870b7999d',
    tags: ['New'],
    totalSupply: '100M DUST',
    launchedDate: 'Sep 7, 2026',
    pairLabel: 'DUST / ASTER',
    chart: makeChart(1725561600).map((point, index) => ({ ...point, value: 0.0021 + index * 0.00008 })),
    trades: [
      { id: 'd-1', time: '11s ago', type: 'Buy', amountToken: 880, amountUsd: 2.7, sender: '0xf0c2...a111', priceUsd: 0.00307 },
      { id: 'd-2', time: '18s ago', type: 'Sell', amountToken: 1200, amountUsd: 3.6, sender: '0xa3bc...8811', priceUsd: 0.003 },
    ],
  },
  {
    address: '0x2573d4629d82dc400419951930631b6dbcb1fe97',
    name: 'Eagledog',
    symbol: 'EAGLEDOG',
    quoteSymbol: 'EAGLE',
    priceUsd: 0.00091,
    change24h: 56.2,
    marketCap: 20240,
    volume24h: 91530,
    liquidity: 7750,
    holders: 207,
    launchedAgo: '4 hr ago',
    description: 'Community spin-off token paired against EAGLE liquidity.',
    creator: '0x22b8240cf6e1b36a2dac7a555969b00d52972222',
    poolAddress: '0x5ea3f9a7b7edbfe0ba3568bfc0f30ba870b71234',
    tags: ['Community'],
    totalSupply: '250M EAGLEDOG',
    launchedDate: 'Sep 7, 2026',
    pairLabel: 'EAGLEDOG / EAGLE',
    chart: makeChart(1725561600).map((point, index) => ({ ...point, value: 0.0005 + index * 0.000025 })),
    trades: [
      { id: 'b-1', time: '7s ago', type: 'Buy', amountToken: 6200, amountUsd: 5.5, sender: '0xd91c...7b2d', priceUsd: 0.00089 },
    ],
  },
];

export const marketOverview: MarketOverview = {
  chain: 'BNB Chain',
  launchedCount: 15,
  totalVolume24h: tokenDetails.reduce((sum, item) => sum + item.volume24h, 0),
  trending: tokenDetails,
  tokens: tokenDetails,
};
