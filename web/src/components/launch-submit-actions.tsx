'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi';
import {
  type Address,
  formatEther,
  formatUnits,
  isAddress,
  keccak256,
  parseEventLogs,
  parseUnits,
  stringToHex,
  zeroAddress,
} from 'viem';
import {
  defaultLaunchConfig,
  eagleDistributorFactoryAbi,
  eagleErc20Abi,
  eagleFactoryAbi,
  getEagleContracts,
  tickSpacingByFeeTier,
} from '@/lib/contracts';
import { getChainConfig, type ChainKey } from '@/lib/chains';
import { type Lang } from '@/lib/i18n';

type PairKey = 'BNB' | 'USDT' | 'ANY';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

type LaunchSubmitActionsProps = {
  lang: Lang;
  chainKey: ChainKey;
  name: string;
  ticker: string;
  story: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  imageUrl: string;
  imageUploading: boolean;
  pair: PairKey;
  feeTarget: 'wallet' | 'holders';
  firstBuy: string;
  feeWallet: string;
  quoteTokenInput: string;
  totalSupply: string;
  feeTier: 100 | 500 | 2500 | 10000;
  initialBuyMinTokensOut: string;
};

const copy = {
  zh: {
    connectWallet: '先连接钱包',
    switchNetwork: '切换到目标网络',
    launchNow: '发射到链上',
    approveFirstBuy: '先授权首购资产',
    saveDraft: '保存草稿',
    quoteTokenAddress: '配对代币地址',
    predictedToken: '预计代币地址',
    distributor: '持有人分发地址',
    platformFee: '创建费',
    firstBuyAmount: '首购金额',
    launchReady: '参数已就绪，可以发射。',
    walletRequired: '请先连接钱包再发射。',
    missingFields: '请先填写代币名称、代码和有效的配对代币地址。',
    holdersPending: '正在计算持有人分发地址，请稍候。',
    invalidParams: '请检查总供应量和首购保护参数是否有效。',
    imageUploading: '代币头像上传中，请稍候...',
    loadingQuotePrice: '正在根据配对币价格计算默认开盘价...',
    quotePriceUnavailable: '暂时无法获取该配对币价格，当前不能按默认开盘价发射。',
    waitingApproval: '等待钱包授权首购资产...',
    switchingNetwork: '正在切换钱包网络...',
    switchNetworkFirst: '请先把钱包切到当前选择的链。',
    approvalSuccess: '授权成功，现在可以发射。',
    waitingLaunch: '等待钱包确认发射交易...',
    launchSuccess: '发射成功，正在跳转到代币详情页。',
    failedPrefix: '交易失败：',
    customQuoteHint: '输入 BSC 上的任意标准 BEP20 地址。',
  },
  en: {
    connectWallet: 'Connect wallet first',
    switchNetwork: 'Switch network',
    launchNow: 'Launch on-chain',
    approveFirstBuy: 'Approve first buy asset',
    saveDraft: 'Save draft',
    quoteTokenAddress: 'Quote token address',
    predictedToken: 'Predicted token',
    distributor: 'Holder distributor',
    platformFee: 'Launch fee',
    firstBuyAmount: 'First buy',
    launchReady: 'Parameters look good. Ready to launch.',
    walletRequired: 'Connect your wallet before launching.',
    missingFields: 'Fill in token name, ticker, and a valid quote token address.',
    holdersPending: 'Calculating holder distributor address...',
    invalidParams: 'Check total supply and first buy protection values.',
    imageUploading: 'Token image is uploading. Please wait...',
    loadingQuotePrice: 'Calculating the default starting price from the quote token...',
    quotePriceUnavailable: 'A usable USD price for this quote token is unavailable right now.',
    waitingApproval: 'Waiting for wallet approval...',
    switchingNetwork: 'Switching wallet network...',
    switchNetworkFirst: 'Switch your wallet to the selected network first.',
    approvalSuccess: 'Approval confirmed. You can launch now.',
    waitingLaunch: 'Waiting for wallet confirmation...',
    launchSuccess: 'Launch confirmed. Redirecting to token page.',
    failedPrefix: 'Transaction failed: ',
    customQuoteHint: 'Enter any standard BEP20 token address on BSC.',
  },
  ja: {
    connectWallet: '先にウォレットを接続',
    switchNetwork: 'ネットワークを切り替え',
    launchNow: 'オンチェーンでローンチ',
    approveFirstBuy: '初回購入資産を承認',
    saveDraft: '下書きを保存',
    quoteTokenAddress: 'ペアトークンアドレス',
    predictedToken: '予定トークンアドレス',
    distributor: '保有者分配アドレス',
    platformFee: '作成手数料',
    firstBuyAmount: '初回購入',
    launchReady: 'パラメータは問題ありません。ローンチ可能です。',
    walletRequired: 'ローンチ前にウォレットを接続してください。',
    missingFields: 'トークン名、ティッカー、有効なペアトークンアドレスを入力してください。',
    holdersPending: '保有者分配アドレスを計算しています...',
    invalidParams: '総供給量と初回購入保護の値を確認してください。',
    imageUploading: 'トークン画像をアップロード中です。少々お待ちください。',
    loadingQuotePrice: 'ペアトークン価格からデフォルト開始価格を計算しています...',
    quotePriceUnavailable: 'このペアトークンの価格を取得できないため、現在はローンチできません。',
    waitingApproval: 'ウォレット承認を待っています...',
    switchingNetwork: 'ウォレットのネットワークを切り替えています...',
    switchNetworkFirst: '先にウォレットを選択中のネットワークへ切り替えてください。',
    approvalSuccess: '承認完了。ローンチできます。',
    waitingLaunch: 'ウォレット確認を待っています...',
    launchSuccess: 'ローンチ完了。トークンページへ移動します。',
    failedPrefix: '取引失敗: ',
    customQuoteHint: 'BSC 上の標準 BEP20 アドレスを入力してください。',
  },
} as const;

function normalizeError(error: unknown, prefix: string) {
  if (error instanceof Error && error.message) {
    return `${prefix}${error.message}`;
  }
  return `${prefix}Unknown error`;
}

async function fetchQuoteUsdPrice(token: Address, chainKey: ChainKey) {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch quote price (${response.status})`);
  }

  const payload = (await response.json()) as {
    pairs?: Array<{
      chainId?: string;
      priceUsd?: string;
      priceNative?: string;
      liquidity?: { usd?: number };
      baseToken?: { address?: string };
      quoteToken?: { address?: string };
    }>;
  };

  const normalizedToken = token.toLowerCase();
  let bestUsdPrice: number | undefined;
  let bestLiquidity = -1;

  for (const pair of payload.pairs ?? []) {
    if (pair.chainId !== getChainConfig(chainKey).dexscreenerChainId) continue;
    const baseAddress = pair.baseToken?.address?.toLowerCase();
    const quoteAddress = pair.quoteToken?.address?.toLowerCase();
    const pairLiquidity = Number(pair.liquidity?.usd ?? 0);
    let derivedUsdPrice: number | undefined;

    if (baseAddress === normalizedToken) {
      const usdPrice = Number(pair.priceUsd);
      if (Number.isFinite(usdPrice) && usdPrice > 0) {
        derivedUsdPrice = usdPrice;
      }
    } else if (quoteAddress === normalizedToken) {
      const baseUsdPrice = Number(pair.priceUsd);
      const basePriceInQuote = Number(pair.priceNative);
      if (Number.isFinite(baseUsdPrice) && baseUsdPrice > 0 && Number.isFinite(basePriceInQuote) && basePriceInQuote > 0) {
        derivedUsdPrice = baseUsdPrice / basePriceInQuote;
      }
    }

    if (derivedUsdPrice !== undefined && pairLiquidity > bestLiquidity) {
      bestUsdPrice = derivedUsdPrice;
      bestLiquidity = pairLiquidity;
    }
  }

  if (bestUsdPrice === undefined) {
    throw new Error('No usable USD price found for quote token');
  }

  return bestUsdPrice;
}

function alignInitialTick(targetTokenUsdPrice: number, quoteTokenUsdPrice: number, tickSpacing: number) {
  const priceInQuote = targetTokenUsdPrice / quoteTokenUsdPrice;
  const rawTick = Math.log(priceInQuote) / Math.log(1.0001);
  const alignedTick = Math.round(rawTick / tickSpacing) * tickSpacing;
  return Math.max(-887200, Math.min(887200, alignedTick));
}

async function queueAutomaticVerification(payload: {
  address: Address;
  name: string;
  symbol: string;
  totalSupply: bigint;
  factoryAddress: Address;
  metadataURI: string;
  creator: Address;
}) {
  const response = await fetch(`${API_BASE}/verify-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      totalSupply: payload.totalSupply.toString(),
    }),
    signal: AbortSignal.timeout(2500),
  });

  if (!response.ok) {
    throw new Error(`Failed to queue token verification (${response.status})`);
  }
}

async function registerLaunchedToken(payload: {
  chainKey: ChainKey;
  address: Address;
  name: string;
  symbol: string;
  description: string;
  creator: Address;
  poolAddress: Address;
  quoteToken: Address;
  quoteSymbol: string;
  totalSupply: bigint;
  metadataURI: string;
  feeTier: number;
  launchedAt: string;
}) {
  const response = await fetch(`${API_BASE}/tokens/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: true,
    body: JSON.stringify({
      ...payload,
      totalSupply: payload.totalSupply.toString(),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to register launched token (${response.status})`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function registerLaunchedTokenWithRetry(
  payload: Parameters<typeof registerLaunchedToken>[0],
  attempts = 4,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await registerLaunchedToken(payload);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to register launched token');
}

export function LaunchSubmitActions({
  lang,
  chainKey,
  name,
  ticker,
  story,
  websiteUrl,
  twitterUrl,
  telegramUrl,
  imageUrl,
  imageUploading,
  pair,
  feeTarget,
  firstBuy,
  feeWallet,
  quoteTokenInput,
  totalSupply,
  feeTier,
  initialBuyMinTokensOut,
}: LaunchSubmitActionsProps) {
  const locale = copy[lang];
  const chain = getChainConfig(chainKey);
  const contracts = getEagleContracts(chainKey);
  const router = useRouter();
  const publicClient = usePublicClient();
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [salt] = useState(() => keccak256(stringToHex(`${Date.now()}-${Math.random()}`)));
  const [quoteUsdPrice, setQuoteUsdPrice] = useState<number>();
  const [quotePriceLoading, setQuotePriceLoading] = useState(false);

  const resolvedQuoteToken = useMemo<Address | undefined>(() => {
    if (pair === 'BNB') return contracts.wrappedNativeToken;
    if (pair === 'USDT') return contracts.stableToken;
    return isAddress(quoteTokenInput) ? (quoteTokenInput as Address) : undefined;
  }, [contracts.stableToken, contracts.wrappedNativeToken, pair, quoteTokenInput]);

  const { data: launchFeeWei } = useReadContract({
    address: contracts.factory,
    abi: eagleFactoryAbi,
    functionName: 'launchFeeWei',
    query: {
      enabled: Boolean(contracts.factory),
    },
  });

  const { data: customQuoteDecimals } = useReadContract({
    address: resolvedQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'decimals',
    query: {
      enabled: pair === 'ANY' && Boolean(resolvedQuoteToken),
    },
  });

  const { data: customQuoteSymbol } = useReadContract({
    address: resolvedQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'symbol',
    query: {
      enabled: pair === 'ANY' && Boolean(resolvedQuoteToken),
    },
  });

  const quoteDecimals = pair === 'ANY' ? Number(customQuoteDecimals ?? 18) : 18;
  const resolvedQuoteSymbol =
    pair === 'BNB'
      ? chain.wrappedNativeSymbol
      : pair === 'USDT'
        ? chain.stableSymbol
        : (customQuoteSymbol ?? 'TOKEN');
  const tickSpacing = tickSpacingByFeeTier[feeTier];

  useEffect(() => {
    if (!resolvedQuoteToken) {
      setQuoteUsdPrice(undefined);
      setQuotePriceLoading(false);
      return;
    }

    const quoteToken = resolvedQuoteToken;
    let cancelled = false;

    async function loadQuoteUsdPrice() {
      try {
        setQuotePriceLoading(true);
        const usdPrice = await fetchQuoteUsdPrice(quoteToken, chainKey);
        if (!cancelled) {
          setQuoteUsdPrice(usdPrice);
        }
      } catch {
        if (!cancelled) {
          setQuoteUsdPrice(undefined);
        }
      } finally {
        if (!cancelled) {
          setQuotePriceLoading(false);
        }
      }
    }

    loadQuoteUsdPrice();

    return () => {
      cancelled = true;
    };
  }, [chainKey, resolvedQuoteToken]);

  const firstBuyAmount = useMemo(() => {
    try {
      return firstBuy && Number(firstBuy) > 0 ? parseUnits(firstBuy, quoteDecimals) : BigInt(0);
    } catch {
      return undefined;
    }
  }, [firstBuy, quoteDecimals]);

  const parsedTotalSupply = useMemo(() => {
    try {
      return totalSupply ? parseUnits(totalSupply, 18) : undefined;
    } catch {
      return undefined;
    }
  }, [totalSupply]);

  const parsedInitialTick = useMemo(() => {
    if (!quoteUsdPrice || quoteUsdPrice <= 0) return undefined;
    return alignInitialTick(defaultLaunchConfig.targetLaunchPriceUsd, quoteUsdPrice, tickSpacing);
  }, [quoteUsdPrice, tickSpacing]);

  const parsedInitialBuyMinTokensOut = useMemo(() => {
    try {
      return initialBuyMinTokensOut ? parseUnits(initialBuyMinTokensOut, 18) : BigInt(0);
    } catch {
      return undefined;
    }
  }, [initialBuyMinTokensOut]);

  const tickAligned = parsedInitialTick !== undefined && parsedInitialTick % tickSpacing === 0;

  const metadataUri = useMemo(() => {
    const payload = JSON.stringify({
      name: name.trim(),
      symbol: ticker.trim(),
      description: story.trim(),
      image: imageUrl || undefined,
      external_url: websiteUrl.trim() || undefined,
      twitter: twitterUrl.trim() || undefined,
      telegram: telegramUrl.trim() || undefined,
    });
    return `data:application/json,${encodeURIComponent(payload)}`;
  }, [imageUrl, name, story, ticker, websiteUrl, twitterUrl, telegramUrl]);

  const readyForPrediction = Boolean(address && name.trim() && ticker.trim());

  const { data: predictedTokenAddress } = useReadContract({
    address: contracts.factory,
    abi: eagleFactoryAbi,
    functionName: 'predictTokenAddress',
    args: readyForPrediction
      ? [
          address as Address,
          salt,
          name.trim(),
          ticker.trim(),
          parsedTotalSupply ?? defaultLaunchConfig.totalSupply,
          metadataUri,
        ]
      : undefined,
    query: {
      enabled: readyForPrediction && Boolean(parsedTotalSupply) && Boolean(contracts.factory),
    },
  });

  const { data: predictedDistributorAddress } = useReadContract({
    address: contracts.distributorFactory,
    abi: eagleDistributorFactoryAbi,
    functionName: 'predict',
    args: predictedTokenAddress ? [predictedTokenAddress] : undefined,
    query: {
      enabled: Boolean(predictedTokenAddress && contracts.distributorFactory),
    },
  });

  const needsApproval = pair !== 'BNB' && Boolean(firstBuyAmount && firstBuyAmount > BigInt(0));

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: resolvedQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'allowance',
    args: address && resolvedQuoteToken && contracts.factory ? [address, contracts.factory] : undefined,
    query: {
      enabled: Boolean(address && resolvedQuoteToken && needsApproval && contracts.factory),
    },
  });

  const approvalSatisfied = !needsApproval || Boolean(currentAllowance && firstBuyAmount !== undefined && currentAllowance >= firstBuyAmount);

  const creatorFeeRecipient = useMemo<Address>(() => {
    if (feeTarget === 'holders') {
      return predictedDistributorAddress ?? zeroAddress;
    }
    if (isAddress(feeWallet)) {
      return feeWallet as Address;
    }
    return zeroAddress;
  }, [feeTarget, feeWallet, predictedDistributorAddress]);

  const isWrongNetwork = isConnected && walletChainId !== undefined && walletChainId !== chain.chainId;

  const formReady =
    isConnected &&
    Boolean(address) &&
    Boolean(contracts.factory) &&
    Boolean(contracts.distributorFactory) &&
    Boolean(name.trim()) &&
    Boolean(ticker.trim()) &&
    Boolean(resolvedQuoteToken) &&
    firstBuyAmount !== undefined &&
    parsedTotalSupply !== undefined &&
    parsedInitialTick !== undefined &&
    parsedInitialBuyMinTokensOut !== undefined &&
    !imageUploading &&
    !quotePriceLoading &&
    tickAligned &&
    (feeTarget !== 'holders' || Boolean(predictedDistributorAddress));

  const canLaunch = formReady && approvalSatisfied && !isWrongNetwork;
  const canApprove = formReady && needsApproval && !approvalSatisfied && !isWrongNetwork;

  async function handleSwitchNetwork() {
    if (!switchChainAsync) {
      setStatus(locale.switchNetworkFirst);
      return;
    }
    try {
      setIsBusy(true);
      setStatus(locale.switchingNetwork);
      await switchChainAsync({ chainId: chain.chainId });
      setStatus('');
    } catch (error) {
      setStatus(normalizeError(error, locale.failedPrefix));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleApprove() {
    if (!resolvedQuoteToken || !firstBuyAmount || firstBuyAmount <= BigInt(0) || !publicClient || !contracts.factory) return;
    try {
      setIsBusy(true);
      setStatus(locale.waitingApproval);
      const hash = await writeContractAsync({
        address: resolvedQuoteToken,
        abi: eagleErc20Abi,
        functionName: 'approve',
        args: [contracts.factory, firstBuyAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchAllowance();
      setStatus(locale.approvalSuccess);
    } catch (error) {
      setStatus(normalizeError(error, locale.failedPrefix));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLaunch() {
    if (
      !address ||
      !resolvedQuoteToken ||
      firstBuyAmount === undefined ||
      parsedTotalSupply === undefined ||
      parsedInitialTick === undefined ||
      parsedInitialBuyMinTokensOut === undefined ||
      !tickAligned ||
      !publicClient
      || !contracts.factory
    ) {
      return;
    }
    try {
      setIsBusy(true);
      setStatus(locale.waitingLaunch);
      const effectiveLaunchFee = launchFeeWei ?? defaultLaunchConfig.maxLaunchFeeWeiFallback;
      const hash = await writeContractAsync({
        address: contracts.factory,
        abi: eagleFactoryAbi,
        functionName: 'launch',
        args: [
          {
            name: name.trim(),
            symbol: ticker.trim(),
            metadataURI: metadataUri,
            totalSupply: parsedTotalSupply,
            quoteToken: resolvedQuoteToken,
            fee: feeTier,
            initialTick: parsedInitialTick,
            positions: [],
            creatorFeeRecipient,
            initialBuyQuoteAmount: firstBuyAmount,
            initialBuyMinTokensOut: parsedInitialBuyMinTokensOut,
            initialBuyRecipient: zeroAddress,
            salt,
            maxLaunchFeeWei: effectiveLaunchFee,
          },
        ],
        value: effectiveLaunchFee + (pair === 'BNB' ? firstBuyAmount : BigInt(0)),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const launchEvents = parseEventLogs({
        abi: eagleFactoryAbi,
        eventName: 'TokenLaunched',
        logs: receipt.logs,
        strict: false,
      });
      const matchedLaunchEvent =
        launchEvents.find((event) =>
          predictedTokenAddress ? event.args.token?.toLowerCase() === predictedTokenAddress.toLowerCase() : true,
        ) ?? launchEvents[0];
      const launchedTokenAddress = matchedLaunchEvent?.args.token ?? predictedTokenAddress;

      if (launchedTokenAddress) {
        try {
          const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
          const poolAddress =
            matchedLaunchEvent?.args.pool ??
            (await publicClient.readContract({
              address: contracts.factory,
              abi: eagleFactoryAbi,
              functionName: 'launches',
              args: [launchedTokenAddress],
            }).then((launchRecord) => launchRecord[2]));
          const quoteToken =
            matchedLaunchEvent?.args.quoteToken ??
            (await publicClient.readContract({
              address: contracts.factory,
              abi: eagleFactoryAbi,
              functionName: 'launches',
              args: [launchedTokenAddress],
            }).then((launchRecord) => launchRecord[1]));
          if (poolAddress && quoteToken) {
            await registerLaunchedTokenWithRetry({
              chainKey,
              address: launchedTokenAddress,
              name: typeof matchedLaunchEvent?.args.name === 'string' ? matchedLaunchEvent.args.name : name.trim(),
              symbol: typeof matchedLaunchEvent?.args.symbol === 'string' ? matchedLaunchEvent.args.symbol : ticker.trim(),
              description: story.trim(),
              creator: address as Address,
              poolAddress,
              quoteToken,
              quoteSymbol: resolvedQuoteSymbol,
              totalSupply: parsedTotalSupply,
              metadataURI:
                typeof matchedLaunchEvent?.args.metadataURI === 'string' ? matchedLaunchEvent.args.metadataURI : metadataUri,
              feeTier: typeof matchedLaunchEvent?.args.fee === 'number' ? matchedLaunchEvent.args.fee : feeTier,
              launchedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
            });
          }
        } catch {
          // Registration is retried client-side; if it still fails, background sync remains as a fallback.
        }
        try {
          await queueAutomaticVerification({
            address: launchedTokenAddress,
            name: name.trim(),
            symbol: ticker.trim(),
            totalSupply: parsedTotalSupply,
            factoryAddress: contracts.factory,
            metadataURI: metadataUri,
            creator: address as Address,
          });
        } catch {
          // Best-effort queueing; launch success should not be blocked by explorer delays.
        }
      }
      setStatus(locale.launchSuccess);
      if (launchedTokenAddress) {
        router.push(`/token?address=${launchedTokenAddress}&lang=${lang}&chain=${chainKey}`);
      }
    } catch (error) {
      setStatus(normalizeError(error, locale.failedPrefix));
    } finally {
      setIsBusy(false);
    }
  }

  const primaryLabel = !isConnected
    ? locale.connectWallet
    : isWrongNetwork
      ? `${locale.switchNetwork} ${chain.name}`
    : !approvalSatisfied
      ? locale.approveFirstBuy
      : locale.launchNow;

  const primaryAction = isWrongNetwork ? handleSwitchNetwork : approvalSatisfied ? handleLaunch : handleApprove;
  const launchFeeText = formatEther(launchFeeWei ?? defaultLaunchConfig.maxLaunchFeeWeiFallback);
  const firstBuyText = firstBuyAmount !== undefined ? formatUnits(firstBuyAmount, quoteDecimals) : '0';

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 rounded-[14px] border border-white/8 bg-[#171916] p-3 text-sm'>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-[#8f9482]'>{locale.platformFee}</span>
          <span className='text-[#f3f1e8]'>{launchFeeText} {chain.nativeSymbol}</span>
        </div>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-[#8f9482]'>Default start</span>
          <span className='text-[#f3f1e8]'>${defaultLaunchConfig.targetLaunchPriceUsd}</span>
        </div>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-[#8f9482]'>{locale.firstBuyAmount}</span>
          <span className='text-[#f3f1e8]'>{firstBuyText}</span>
        </div>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-[#8f9482]'>{locale.quoteTokenAddress}</span>
          <span className='max-w-[60%] truncate text-right text-[#f3f1e8]'>
            {resolvedQuoteToken ?? (pair === 'ANY' ? locale.customQuoteHint : '—')}
          </span>
        </div>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-[#8f9482]'>{locale.predictedToken}</span>
          <span className='max-w-[60%] truncate text-right text-[#f3f1e8]'>{predictedTokenAddress ?? '—'}</span>
        </div>
        {feeTarget === 'holders' ? (
          <div className='flex items-center justify-between gap-4'>
            <span className='text-[#8f9482]'>{locale.distributor}</span>
            <span className='max-w-[60%] truncate text-right text-[#f3f1e8]'>{predictedDistributorAddress ?? '—'}</span>
          </div>
        ) : null}
      </div>
      <p className='text-sm leading-7 text-[#8f9482]'>
        {!isConnected
          ? locale.walletRequired
          : isWrongNetwork
            ? locale.switchNetworkFirst
          : !name.trim() || !ticker.trim() || !resolvedQuoteToken || firstBuyAmount === undefined
            ? locale.missingFields
            : imageUploading
              ? locale.imageUploading
            : quotePriceLoading
              ? locale.loadingQuotePrice
              : quoteUsdPrice === undefined
                ? locale.quotePriceUnavailable
            : parsedTotalSupply === undefined || parsedInitialTick === undefined || parsedInitialBuyMinTokensOut === undefined || !tickAligned
              ? locale.invalidParams
            : feeTarget === 'holders' && !predictedDistributorAddress
              ? locale.holdersPending
              : locale.launchReady}
      </p>
      {status ? <p className='text-sm text-[#d8c483]'>{status}</p> : null}
      <div className='flex flex-wrap items-center gap-3'>
        <button
          type='button'
          onClick={primaryAction}
          disabled={!(approvalSatisfied ? canLaunch : canApprove) || isBusy}
          className='inline-flex h-11 items-center rounded-full border border-[#f6e3ac66] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] px-5 text-sm font-medium text-[#342d1a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {isBusy ? '...' : primaryLabel}
        </button>
        <button
          type='button'
          className='inline-flex h-11 items-center rounded-full border border-white/10 bg-transparent px-5 text-sm font-medium text-[#c5c9bc] transition hover:bg-white/[0.04]'
        >
          {locale.saveDraft}
        </button>
      </div>
    </div>
  );
}
