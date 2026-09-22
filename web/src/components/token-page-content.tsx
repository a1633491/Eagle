'use client';

import { ArrowUpRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePublicClient, useReadContract } from 'wagmi';
import { type Abi, type Address, formatUnits, isAddress, parseEventLogs, zeroAddress } from 'viem';
import { SwapPanel } from '@/components/swap-panel';
import { TokenChainActions } from '@/components/token-chain-actions';
import { TokenMarketSections } from '@/components/token-market-sections';
import { getChainConfig, type ChainKey } from '@/lib/chains';
import { currency, percent, shorten } from '@/lib/format';
import { eagleErc20Abi, eagleLiquidityLockerAbi, getEagleContracts, getLaunchFactoryAbi } from '@/lib/contracts';
import { t, type Lang } from '@/lib/i18n';
import { getTokenImageUrl } from '@/lib/token-image';
import { type TokenDetail } from '@/lib/types';
import { useLiveTokenMarket } from '@/lib/use-live-token-market';

function getFallbackQuoteContract(token: TokenDetail, chainKey: ChainKey) {
  const chain = getChainConfig(chainKey);
  const contracts = getEagleContracts(chainKey);
  if (token.quoteSymbol === chain.wrappedNativeSymbol) return contracts.wrappedNativeToken;
  if (token.quoteSymbol === chain.stableSymbol) return contracts.stableToken;
  return token.poolAddress as Address;
}

function readAddress(value: unknown): Address | undefined {
  return typeof value === 'string' && isAddress(value) ? (value as Address) : undefined;
}

function readBigint(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  return undefined;
}

function readIsoTimestamp(value: string | undefined): bigint | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return BigInt(Math.floor(ms / 1000));
}

function absBigint(value: bigint) {
  return value < BigInt(0) ? -value : value;
}

function formatSupply(amount: bigint | undefined, decimals: number | undefined, symbol: string) {
  if (amount === undefined) return `— ${symbol}`;
  const value = Number(formatUnits(amount, decimals ?? 18));
  if (!Number.isFinite(value)) return `— ${symbol}`;
  return `${new Intl.NumberFormat('en-US', {
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 2 : 4,
  }).format(value)} ${symbol}`;
}

function getLocale(lang: Lang) {
  if (lang === 'zh') return 'zh-CN';
  if (lang === 'ja') return 'ja-JP';
  return 'en-US';
}

function formatLaunchDate(timestamp: bigint | undefined, lang: Lang, fallback: string) {
  if (!timestamp) return fallback;
  return new Intl.DateTimeFormat(getLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Number(timestamp) * 1000));
}

function formatRelativeLaunch(timestamp: bigint | undefined, fallback: string, lang: Lang) {
  if (!timestamp) return fallback;
  const diffMs = Number(timestamp) * 1000 - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const rtf = new Intl.RelativeTimeFormat(getLocale(lang), { numeric: 'auto' });
  if (Math.abs(diffHours) < 48) {
    return rtf.format(diffHours, 'hour');
  }
  return rtf.format(Math.round(diffHours / 24), 'day');
}

export function TokenPageContent({ lang, token, chainKey }: { lang: Lang; token: TokenDetail; chainKey: ChainKey }) {
  const maxLaunchTimestampDrift = BigInt(7 * 24 * 60 * 60);
  const chain = getChainConfig(chainKey);
  const contracts = getEagleContracts(chainKey);
  const factoryAbi = getLaunchFactoryAbi(chainKey) as Abi;
  const publicClient = usePublicClient({ chainId: contracts.chainId });
  const [launchTimestamp, setLaunchTimestamp] = useState<bigint | undefined>();
  const [launchTxHash, setLaunchTxHash] = useState<string | undefined>();
  const backendLaunchTimestamp = useMemo(() => readIsoTimestamp(token.launchedAt), [token.launchedAt]);

  const normalizedToken = isAddress(token.address) ? (token.address as Address) : undefined;

  const { data: launchRecord } = useReadContract({
    chainId: contracts.chainId,
    address: contracts.factory,
    abi: factoryAbi,
    functionName: 'launches',
    args: normalizedToken ? [normalizedToken] : undefined,
    query: {
      enabled: Boolean(normalizedToken && contracts.factory),
    },
  });
  const launchRecordTuple = launchRecord as readonly unknown[] | undefined;
  const onchainQuoteToken = readAddress(launchRecordTuple?.[1]);
  const onchainPool = chainKey === 'robinhood' ? undefined : readAddress(launchRecordTuple?.[2]);
  const onchainCreator = readAddress(launchRecordTuple?.[chainKey === 'robinhood' ? 2 : 3]);
  const onchainFeeTier = readNumber(launchRecordTuple?.[chainKey === 'robinhood' ? 3 : 4]);
  const onchainLaunchBlock = readBigint(launchRecordTuple?.[chainKey === 'robinhood' ? 7 : 5]);

  const { data: tokenSymbolData } = useReadContract({
    chainId: contracts.chainId,
    address: normalizedToken,
    abi: eagleErc20Abi,
    functionName: 'symbol',
    query: {
      enabled: Boolean(normalizedToken),
    },
  });

  const { data: tokenNameData } = useReadContract({
    chainId: contracts.chainId,
    address: normalizedToken,
    abi: eagleErc20Abi,
    functionName: 'name',
    query: {
      enabled: Boolean(normalizedToken),
    },
  });

  const { data: tokenDecimalsData } = useReadContract({
    chainId: contracts.chainId,
    address: normalizedToken,
    abi: eagleErc20Abi,
    functionName: 'decimals',
    query: {
      enabled: Boolean(normalizedToken),
    },
  });

  const { data: tokenTotalSupplyData } = useReadContract({
    chainId: contracts.chainId,
    address: normalizedToken,
    abi: eagleErc20Abi,
    functionName: 'totalSupply',
    query: {
      enabled: Boolean(normalizedToken),
    },
  });

  const { data: quoteSymbolData } = useReadContract({
    chainId: contracts.chainId,
    address: onchainQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'symbol',
    query: {
      enabled: Boolean(onchainQuoteToken),
      refetchInterval: 15000,
    },
  });

  const { data: quoteDecimalsData } = useReadContract({
    chainId: contracts.chainId,
    address: onchainQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'decimals',
    query: {
      enabled: Boolean(onchainQuoteToken),
      refetchInterval: 15000,
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function loadLaunchMeta() {
      if (!publicClient || !normalizedToken || !onchainLaunchBlock || onchainLaunchBlock === BigInt(0)) {
        if (!cancelled) {
          setLaunchTimestamp(undefined);
          setLaunchTxHash(undefined);
        }
        return;
      }
      try {
        const [block, logs] = await Promise.all([
          publicClient.getBlock({ blockNumber: onchainLaunchBlock }),
          publicClient.getLogs({
            address: contracts.factory,
            fromBlock: onchainLaunchBlock,
            toBlock: onchainLaunchBlock,
          }),
        ]);
        const launchLogs = parseEventLogs({
          abi: factoryAbi,
          eventName: 'TokenLaunched',
          logs,
          strict: false,
        }) as Array<{ args: Record<string, unknown>; transactionHash?: string }>;
        const matchingLog = launchLogs.find((event) => readAddress(event.args.token)?.toLowerCase() === normalizedToken.toLowerCase());
        const timestampMatchesBackend =
          !backendLaunchTimestamp || absBigint(block.timestamp - backendLaunchTimestamp) <= maxLaunchTimestampDrift;
        if (!cancelled) {
          setLaunchTimestamp(timestampMatchesBackend ? block.timestamp : undefined);
          setLaunchTxHash(timestampMatchesBackend ? matchingLog?.transactionHash : undefined);
        }
      } catch {
        if (!cancelled) {
          setLaunchTimestamp(undefined);
          setLaunchTxHash(undefined);
        }
      }
    }
    void loadLaunchMeta();
    return () => {
      cancelled = true;
    };
  }, [backendLaunchTimestamp, contracts.factory, factoryAbi, maxLaunchTimestampDrift, normalizedToken, onchainLaunchBlock, publicClient]);

  const symbol = tokenSymbolData ?? token.symbol;
  const quoteContract = onchainQuoteToken ?? getFallbackQuoteContract(token, chainKey);
  const poolAddress = onchainPool && onchainPool !== zeroAddress ? onchainPool : token.poolAddress;
  const creatorAddress = onchainCreator && onchainCreator !== zeroAddress ? onchainCreator : token.creator;
  const { data: creatorClaimableFees } = useReadContract({
    chainId: contracts.chainId,
    address: contracts.locker,
    abi: eagleLiquidityLockerAbi,
    functionName: 'claimableFees',
    args: creatorAddress && quoteContract ? [creatorAddress as Address, quoteContract as Address] : undefined,
    query: {
      enabled: Boolean(creatorAddress && quoteContract && contracts.locker),
      refetchInterval: 15000,
    },
  });
  const liveMarket = useLiveTokenMarket(token.address, chainKey, {
    priceUsd: token.priceUsd,
    change24h: token.change24h,
    volume24h: token.volume24h,
    liquidity: token.liquidity,
    marketCap: token.marketCap,
    poolAddress: poolAddress,
    quoteSymbol: quoteSymbolData ?? token.quoteSymbol,
  });
  const displayName = tokenNameData ?? token.name;
  const quoteSymbol = liveMarket.quoteSymbol ?? quoteSymbolData ?? token.quoteSymbol;
  const effectiveLaunchTimestamp = launchTimestamp ?? backendLaunchTimestamp;
  const launchedAgo = formatRelativeLaunch(effectiveLaunchTimestamp, token.launchedAgo, lang);
  const launchedDate = formatLaunchDate(effectiveLaunchTimestamp, lang, token.launchedDate);
  const pairLabel = `${symbol} / ${quoteSymbol}`;
  const totalSupply = formatSupply(tokenTotalSupplyData, tokenDecimalsData, symbol);
  const imageUrl = getTokenImageUrl(token.metadataURI);
  const creatorClaimableText = useMemo(() => {
    return `${formatUnits(creatorClaimableFees ?? BigInt(0), Number(quoteDecimalsData ?? 18))} ${quoteSymbol}`.trim();
  }, [creatorClaimableFees, quoteDecimalsData, quoteSymbol]);
  const feeTierLabel = useMemo(() => {
    if (onchainFeeTier === undefined) return null;
    return `${Number(onchainFeeTier) / 10000}%`;
  }, [onchainFeeTier]);
  const tags = useMemo(() => {
    const nextTags = [...token.tags];
    if (feeTierLabel && !nextTags.includes(feeTierLabel)) nextTags.push(feeTierLabel);
    return nextTags;
  }, [feeTierLabel, token.tags]);
  const liveToken = useMemo(
    () => ({
      ...token,
      priceUsd: liveMarket.priceUsd ?? token.priceUsd,
      change24h: liveMarket.change24h ?? token.change24h,
      marketCap: liveMarket.marketCap ?? token.marketCap,
      volume24h: liveMarket.volume24h ?? token.volume24h,
      liquidity: liveMarket.liquidity ?? token.liquidity,
      quoteSymbol,
      pairLabel,
    }),
    [liveMarket.change24h, liveMarket.liquidity, liveMarket.marketCap, liveMarket.priceUsd, liveMarket.volume24h, pairLabel, quoteSymbol, token],
  );

  return (
    <>
      <section className='min-w-0 space-y-5'>
        <div className='rounded-[24px] border border-white/8 bg-[#1a1c19]/96 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:p-5'>
          <div className='mb-1 text-[13px] text-[#8f9482]'>
            <span className='text-[#cfd3c3]'>{t(lang, 'explore')}</span>
            <span className='mx-1'>/</span>
            <span>{symbol}</span>
          </div>
          <div className='mb-1 text-[13px] text-[#8f9482]'>{chain.name}</div>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div className='min-w-0'>
              <div className='mt-1.5 flex items-center gap-3'>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={displayName}
                    className='h-11 w-11 rounded-full border border-[#d8c48333] object-cover'
                  />
                ) : (
                  <div className='flex h-11 w-11 items-center justify-center rounded-full border border-[#d8c48333] bg-[#ffffff06] text-base font-semibold text-[#d1b773]'>
                    {symbol.slice(0, 2)}
                  </div>
                )}
                <div className='min-w-0'>
                  <h1 className='truncate text-[1.6rem] font-semibold tracking-[-0.06em] text-[#f3f1e8] sm:text-[2rem]'>{symbol}</h1>
                  <div className='mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-[#c6c8bd]'>
                    {token.official ? <span className='text-[#d8c483]'>{t(lang, 'official')}</span> : null}
                    <span className='break-all sm:break-normal'>{displayName}</span>
                    <span>${symbol}</span>
                  </div>
                </div>
              </div>
              <div className='mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[#8f9482]'>
                <span>
                  {t(lang, 'launched')} {launchedAgo}
                </span>
                <span>{shorten(token.address)}</span>
                <a
                  href={`${chain.explorerBaseUrl}/token/${token.address}`}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-1 text-[#d8c483] transition hover:text-[#f1e4b7]'
                >
                  {t(lang, 'bscScan')}
                  <ArrowUpRight className='h-3.5 w-3.5' />
                </a>
              </div>
              <div className='mt-3 flex flex-wrap gap-2'>
                {tags.map((tag) => (
                  <span key={tag} className='rounded-full border border-[#e8d79f2f] bg-[#ffffff05] px-2.5 py-1 text-xs text-[#d8c483]'>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className='text-left sm:text-right'>
              <p className='text-[13px] text-[#8f9482]'>{t(lang, 'priceUsd')}</p>
              <p className='mt-1 text-[1.6rem] font-semibold text-[#f3f1e8] sm:text-[2rem]'>{currency(liveToken.priceUsd)}</p>
              <p className={`mt-1 text-[13px] ${liveToken.change24h >= 0 ? 'text-[#8fd19e]' : 'text-[#e28989]'}`}>{percent(liveToken.change24h)} 24h</p>
              <p className='mt-1 text-xs text-[#8f9482]'>{t(lang, 'live')}</p>
            </div>
          </div>
          <p className='mt-4 max-w-3xl text-[13px] leading-6 text-[#b6bba9]'>{token.description}</p>
        </div>
        <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
          <MetricCard label={t(lang, 'marketCapLabel')} value={currency(liveToken.marketCap)} />
          <MetricCard label={t(lang, 'volume24h')} value={currency(liveToken.volume24h)} />
          <MetricCard label={t(lang, 'holders')} value='—' />
          <MetricCard label={t(lang, 'trades24h')} value='—' />
        </div>
        <div className='rounded-[18px] border border-white/8 bg-[#171916] px-4 py-3 text-sm text-[#9da28f]'>
          {t(lang, 'catchingUp')}
        </div>
        <TokenMarketSections lang={lang} token={liveToken} />
      </section>
      <aside className='min-w-0 space-y-6'>
        {chainKey !== 'robinhood' ? <SwapPanel lang={lang} token={liveToken} creatorClaimableText={creatorClaimableText} /> : null}
        <TokenChainActions lang={lang} tokenAddress={token.address} chainKey={chainKey} />
        <div className='rounded-[24px] border border-white/8 bg-[#1a1c19]/96 p-4 sm:p-5'>
          <h2 className='text-lg font-semibold text-[#f3f1e8]'>{t(lang, 'tokenDetails')}</h2>
          <div className='mt-4 divide-y divide-white/6 rounded-[18px] border border-white/8 bg-[#131512] text-sm text-[#a8ad99]'>
            <DetailRow label={t(lang, 'tradingPair')} value={pairLabel} />
            <DetailLink label={t(lang, 'quoteContract')} href={`${chain.explorerBaseUrl}/token/${quoteContract}`} value={shorten(quoteContract)} />
            {poolAddress && poolAddress !== zeroAddress ? (
              <DetailLink label={t(lang, 'pool')} href={`${chain.explorerBaseUrl}/address/${poolAddress}`} value={shorten(poolAddress)} />
            ) : (
              <DetailRow label={t(lang, 'pool')} value='—' />
            )}
            <DetailLink label={t(lang, 'creator')} href={`${chain.explorerBaseUrl}/address/${creatorAddress}`} value={shorten(creatorAddress)} />
            <DetailRow label={t(lang, 'totalSupply')} value={totalSupply} />
            <DetailRow label={t(lang, 'launched')} value={launchedDate} />
          </div>
          {launchTxHash ? (
            <a
              href={`${chain.explorerBaseUrl}/tx/${launchTxHash}`}
              target='_blank'
              rel='noreferrer'
              className='mt-4 inline-flex items-center gap-1 text-sm text-[#d8c483] transition hover:text-[#f1e4b7]'
            >
              {t(lang, 'viewLaunchTx')}
              <ArrowUpRight className='h-3.5 w-3.5' />
            </a>
          ) : null}
          <p className='mt-4 text-xs text-[#8f9482]'>
            {t(lang, 'docsContractsHint')}
          </p>
        </div>
      </aside>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-[18px] border border-white/8 bg-[#1a1c19]/96 p-3.5'>
      <p className='text-[13px] text-[#8f9482]'>{label}</p>
      <p className='mt-1 text-[1.05rem] font-semibold text-[#f3f1e8]'>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
      <span>{label}</span>
      <span className='break-all text-left text-[#f3f1e8] sm:text-right'>{value}</span>
    </div>
  );
}

function DetailLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <div className='flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
      <span>{label}</span>
      <a href={href} target='_blank' rel='noreferrer' className='inline-flex break-all text-left items-center gap-1 text-[#f3f1e8] transition hover:text-[#f1e4b7] sm:text-right'>
        {value}
        <ArrowUpRight className='h-3.5 w-3.5' />
      </a>
    </div>
  );
}
