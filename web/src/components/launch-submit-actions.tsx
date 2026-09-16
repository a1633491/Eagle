'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi';
import {
  type Abi,
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
  getLaunchFactoryAbi,
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
    loadingLaunchFee: '正在读取链上创建费，请稍候...',
    metadataTooLarge: '代币资料过长，已超出合约允许的 metadata 长度，请缩短简介或社媒链接。',
    metadataCompacted: '链上 metadata 已自动压缩到合约允许的长度内。',
    preflightLaunch: '正在检查交易参数和钱包余额...',
    waitingApproval: '等待钱包授权首购资产...',
    switchingNetwork: '正在切换钱包网络...',
    switchNetworkFirst: '请先把钱包切到当前选择的链。',
    approvalSuccess: '授权成功，现在可以发射。',
    waitingLaunch: '等待钱包确认发射交易...',
    launchSuccess: '发射成功，正在跳转到代币详情页。',
    insufficientNativeForLaunch: '钱包余额不足。使用当前链原生资产首购时，余额至少要覆盖首购金额以及额外的链上 gas。',
    robinhoodWalletFeesOnly: '当前链当前仅支持钱包接收创作者费用。',
    robinhoodFirstBuyDisabled: '当前链首购参数无效，请检查授权、首购金额和最少收到数量。',
    failedPrefix: '交易失败：',
    customQuoteHint: '输入当前链上的任意标准代币地址。',
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
    loadingLaunchFee: 'Loading the on-chain launch fee...',
    metadataTooLarge: 'Token metadata is too long for the contract. Shorten the description or social links.',
    metadataCompacted: 'On-chain metadata was compacted automatically to satisfy the contract length limit.',
    preflightLaunch: 'Checking launch parameters and wallet balance...',
    waitingApproval: 'Waiting for wallet approval...',
    switchingNetwork: 'Switching wallet network...',
    switchNetworkFirst: 'Switch your wallet to the selected network first.',
    approvalSuccess: 'Approval confirmed. You can launch now.',
    waitingLaunch: 'Waiting for wallet confirmation...',
    launchSuccess: 'Launch confirmed. Redirecting to token page.',
    insufficientNativeForLaunch:
      'Wallet balance is too low. When the first buy uses the chain native asset, it must cover both the buy value and extra network gas.',
    robinhoodWalletFeesOnly: 'This chain currently supports wallet-based creator fees only.',
    robinhoodFirstBuyDisabled: 'The first-buy parameters are invalid for this chain. Check approval, the buy amount, and min tokens out.',
    failedPrefix: 'Transaction failed: ',
    customQuoteHint: 'Enter any standard token address on the selected chain.',
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
    loadingLaunchFee: 'オンチェーンの作成手数料を読み込んでいます...',
    metadataTooLarge: 'トークンの metadata が長すぎてコントラクト制限を超えています。説明文か SNS リンクを短くしてください。',
    metadataCompacted: 'オンチェーン metadata はコントラクト制限に収まるよう自動で圧縮されました。',
    preflightLaunch: '取引パラメータとウォレット残高を確認しています...',
    waitingApproval: 'ウォレット承認を待っています...',
    switchingNetwork: 'ウォレットのネットワークを切り替えています...',
    switchNetworkFirst: '先にウォレットを選択中のネットワークへ切り替えてください。',
    approvalSuccess: '承認完了。ローンチできます。',
    waitingLaunch: 'ウォレット確認を待っています...',
    launchSuccess: 'ローンチ完了。トークンページへ移動します。',
    insufficientNativeForLaunch:
      'ウォレット残高が不足しています。チェーンのネイティブ資産で初回購入する場合、購入額に加えてネットワーク gas も必要です。',
    robinhoodWalletFeesOnly: 'このチェーンでは現在、クリエイター手数料の受取先はウォレットのみ対応です。',
    robinhoodFirstBuyDisabled: 'このチェーンの初回購入パラメータが無効です。承認、購入額、最少受取量を確認してください。',
    failedPrefix: '取引失敗: ',
    customQuoteHint: '選択中のチェーン上の標準トークンアドレスを入力してください。',
  },
} as const;

const MAX_ONCHAIN_METADATA_URI_LENGTH = 2048;

function normalizeError(error: unknown, prefix: string) {
  if (error instanceof Error && error.message) {
    return `${prefix}${error.message}`;
  }
  return `${prefix}Unknown error`;
}

function isInsufficientFundsError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  const normalized = message.toLowerCase();
  return normalized.includes('insufficient funds') || normalized.includes('exceeds the balance of the account');
}

function readAddress(value: unknown): Address | undefined {
  return typeof value === 'string' && isAddress(value) ? (value as Address) : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  return undefined;
}

function readBigint(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  return undefined;
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

function alignInitialTick(
  targetTokenUsdPrice: number,
  quoteTokenUsdPrice: number,
  tickSpacing: number,
  quoteTokenDecimals: number,
  tokenDecimals = 18,
) {
  const priceInQuote = targetTokenUsdPrice / quoteTokenUsdPrice;
  const decimalScale = 10 ** (quoteTokenDecimals - tokenDecimals);
  const rawPoolPrice = priceInQuote * decimalScale;
  const rawTick = Math.log(rawPoolPrice) / Math.log(1.0001);
  const alignedTick = Math.round(rawTick / tickSpacing) * tickSpacing;
  return Math.max(-887200, Math.min(887200, alignedTick));
}

function encodeMetadataUri(payload: Record<string, string | undefined>) {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
  );
  return `data:application/json,${encodeURIComponent(JSON.stringify(sanitizedPayload))}`;
}

function buildLaunchMetadataUri(input: {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
}) {
  const fullMetadataUri = encodeMetadataUri({
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image: input.imageUrl,
    external_url: input.websiteUrl,
    twitter: input.twitterUrl,
    telegram: input.telegramUrl,
  });
  if (fullMetadataUri.length <= MAX_ONCHAIN_METADATA_URI_LENGTH) {
    return { metadataUri: fullMetadataUri, compacted: false };
  }

  const compactMetadataUri = encodeMetadataUri({
    name: input.name,
    symbol: input.symbol,
    image: input.imageUrl,
  });
  if (compactMetadataUri.length <= MAX_ONCHAIN_METADATA_URI_LENGTH) {
    return { metadataUri: compactMetadataUri, compacted: true };
  }

  const minimalMetadataUri = encodeMetadataUri({
    name: input.name,
    symbol: input.symbol,
  });
  if (minimalMetadataUri.length <= MAX_ONCHAIN_METADATA_URI_LENGTH) {
    return { metadataUri: minimalMetadataUri, compacted: true };
  }

  return { metadataUri: undefined, compacted: true };
}

async function queueAutomaticVerification(payload: {
  chainKey: ChainKey;
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
  const factoryAbi = getLaunchFactoryAbi(chainKey) as Abi;
  const router = useRouter();
  const publicClient = usePublicClient({ chainId: contracts.chainId });
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [salt] = useState(() => keccak256(stringToHex(`${Date.now()}-${Math.random()}`)));
  const [quoteUsdPrice, setQuoteUsdPrice] = useState<number>();
  const [quotePriceLoading, setQuotePriceLoading] = useState(false);
  const supportsHolderDistributor = Boolean(contracts.distributorFactory && contracts.distributorFactory !== zeroAddress);

  const resolvedQuoteToken = useMemo<Address | undefined>(() => {
    if (pair === 'BNB') return contracts.wrappedNativeToken;
    if (pair === 'USDT') return contracts.stableToken;
    return isAddress(quoteTokenInput) ? (quoteTokenInput as Address) : undefined;
  }, [contracts.stableToken, contracts.wrappedNativeToken, pair, quoteTokenInput]);

  const { data: launchFeeWei } = useReadContract({
    chainId: contracts.chainId,
    address: contracts.factory,
    abi: factoryAbi,
    functionName: 'launchFeeWei',
    query: {
      enabled: Boolean(contracts.factory),
    },
  });
  const resolvedLaunchFeeWei = readBigint(launchFeeWei);
  const launchFeeUnavailable = resolvedLaunchFeeWei === undefined;

  const { data: quoteTokenDecimals } = useReadContract({
    chainId: contracts.chainId,
    address: resolvedQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'decimals',
    query: {
      enabled: Boolean(resolvedQuoteToken),
    },
  });

  const { data: customQuoteSymbol } = useReadContract({
    chainId: contracts.chainId,
    address: resolvedQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'symbol',
    query: {
      enabled: pair === 'ANY' && Boolean(resolvedQuoteToken),
    },
  });

  const quoteDecimals = Number(quoteTokenDecimals ?? 18);
  const resolvedQuoteSymbol =
    pair === 'BNB'
      ? chain.wrappedNativeSymbol
      : pair === 'USDT'
        ? chain.stableSymbol
        : (customQuoteSymbol ?? 'TOKEN');
  const tickSpacing = tickSpacingByFeeTier[feeTier];
  const nativeFirstBuyUsesValue = pair === 'BNB' && chain.nativeFirstBuyUsesValue !== false;

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
    return alignInitialTick(defaultLaunchConfig.targetLaunchPriceUsd, quoteUsdPrice, tickSpacing, quoteDecimals);
  }, [quoteDecimals, quoteUsdPrice, tickSpacing]);

  const parsedInitialBuyMinTokensOut = useMemo(() => {
    try {
      return initialBuyMinTokensOut ? parseUnits(initialBuyMinTokensOut, 18) : BigInt(0);
    } catch {
      return undefined;
    }
  }, [initialBuyMinTokensOut]);

  const tickAligned = parsedInitialTick !== undefined && parsedInitialTick % tickSpacing === 0;

  const { metadataUri, compacted: metadataCompacted } = useMemo(
    () =>
      buildLaunchMetadataUri({
        name: name.trim(),
        symbol: ticker.trim(),
        description: story.trim(),
        imageUrl: imageUrl.trim(),
        websiteUrl: websiteUrl.trim(),
        twitterUrl: twitterUrl.trim(),
        telegramUrl: telegramUrl.trim(),
      }),
    [imageUrl, name, story, ticker, websiteUrl, twitterUrl, telegramUrl],
  );

  const readyForPrediction = Boolean(address && name.trim() && ticker.trim());

  const { data: predictedTokenAddress } = useReadContract({
    chainId: contracts.chainId,
    address: contracts.factory,
    abi: factoryAbi,
    functionName: 'predictTokenAddress',
    args: readyForPrediction
      ? [
          address as Address,
          salt,
          name.trim(),
          ticker.trim(),
          parsedTotalSupply ?? defaultLaunchConfig.totalSupply,
          metadataUri ?? '',
        ]
      : undefined,
    query: {
      enabled: readyForPrediction && Boolean(parsedTotalSupply) && Boolean(contracts.factory),
    },
  });

  const { data: predictedDistributorAddress } = useReadContract({
    chainId: contracts.chainId,
    address: contracts.distributorFactory,
    abi: eagleDistributorFactoryAbi,
    functionName: 'predict',
    args: readAddress(predictedTokenAddress) ? [readAddress(predictedTokenAddress)!] : undefined,
    query: {
      enabled: Boolean(predictedTokenAddress && supportsHolderDistributor && contracts.distributorFactory),
    },
  });
  const resolvedPredictedTokenAddress = readAddress(predictedTokenAddress);
  const resolvedPredictedDistributorAddress = readAddress(predictedDistributorAddress);

  const holderFeeUnsupported = feeTarget === 'holders' && !supportsHolderDistributor;
  const firstBuyUnsupported = false;
  const needsApproval = !nativeFirstBuyUsesValue && Boolean(firstBuyAmount && firstBuyAmount > BigInt(0));

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    chainId: contracts.chainId,
    address: resolvedQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'allowance',
    args: address && resolvedQuoteToken && contracts.factory ? [address, contracts.factory] : undefined,
    query: {
      enabled: Boolean(address && resolvedQuoteToken && needsApproval && contracts.factory),
    },
  });
  const resolvedCurrentAllowance = readBigint(currentAllowance);
  const approvalSatisfied =
    !needsApproval || Boolean(resolvedCurrentAllowance && firstBuyAmount !== undefined && resolvedCurrentAllowance >= firstBuyAmount);

  const creatorFeeRecipient = useMemo<Address>(() => {
    if (feeTarget === 'holders') {
      return resolvedPredictedDistributorAddress ?? zeroAddress;
    }
    if (isAddress(feeWallet)) {
      return feeWallet as Address;
    }
    return zeroAddress;
  }, [feeTarget, feeWallet, resolvedPredictedDistributorAddress]);

  const isWrongNetwork = isConnected && walletChainId !== undefined && walletChainId !== chain.chainId;

  const formReady =
    isConnected &&
    Boolean(address) &&
    Boolean(contracts.factory) &&
    Boolean(name.trim()) &&
    Boolean(ticker.trim()) &&
    Boolean(resolvedQuoteToken) &&
    !launchFeeUnavailable &&
    firstBuyAmount !== undefined &&
    parsedTotalSupply !== undefined &&
    parsedInitialTick !== undefined &&
    parsedInitialBuyMinTokensOut !== undefined &&
    !imageUploading &&
    !quotePriceLoading &&
    Boolean(metadataUri) &&
    !holderFeeUnsupported &&
    !firstBuyUnsupported &&
    tickAligned &&
    (feeTarget !== 'holders' || Boolean(resolvedPredictedDistributorAddress));

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
      if (isInsufficientFundsError(error)) {
        setStatus(locale.insufficientNativeForLaunch);
      } else {
        setStatus(normalizeError(error, locale.failedPrefix));
      }
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
      !metadataUri ||
      !tickAligned ||
      !publicClient ||
      !contracts.factory
    ) {
      return;
    }
    try {
      setIsBusy(true);
      const effectiveLaunchFee = resolvedLaunchFeeWei;
      if (effectiveLaunchFee === undefined) {
        setStatus(locale.loadingLaunchFee);
        return;
      }
      const launchArgs = [
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
      ];
      const txValue = effectiveLaunchFee + (nativeFirstBuyUsesValue ? firstBuyAmount : BigInt(0));
      setStatus(locale.preflightLaunch);
      await publicClient.estimateContractGas({
        account: address as Address,
        address: contracts.factory,
        abi: factoryAbi,
        functionName: 'launch',
        args: launchArgs,
        value: txValue,
      });
      setStatus(locale.waitingLaunch);
      const hash = await writeContractAsync({
        address: contracts.factory,
        abi: factoryAbi,
        functionName: 'launch',
        args: launchArgs,
        value: txValue,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const launchEvents = parseEventLogs({
        abi: factoryAbi,
        eventName: 'TokenLaunched',
        logs: receipt.logs,
        strict: false,
      }) as Array<{ args: Record<string, unknown> }>;
      const matchedLaunchEvent =
        launchEvents.find((event) =>
          resolvedPredictedTokenAddress
            ? typeof event.args.token === 'string' && event.args.token.toLowerCase() === resolvedPredictedTokenAddress.toLowerCase()
            : true,
        ) ?? launchEvents[0];
      const eventArgs = matchedLaunchEvent?.args;
      const launchedTokenAddress = readAddress(eventArgs?.token) ?? resolvedPredictedTokenAddress;

      if (launchedTokenAddress) {
        try {
          const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
          const launchRecord = (await publicClient.readContract({
            address: contracts.factory,
            abi: factoryAbi,
            functionName: 'launches',
            args: [launchedTokenAddress],
          })) as readonly unknown[];
          const poolAddress = readAddress(eventArgs?.pool) ?? readAddress(launchRecord?.[2]) ?? zeroAddress;
          const quoteToken = readAddress(eventArgs?.quoteToken) ?? readAddress(launchRecord?.[1]);
          if (poolAddress && quoteToken) {
            await registerLaunchedTokenWithRetry({
              chainKey,
              address: launchedTokenAddress,
              name: typeof eventArgs?.name === 'string' ? eventArgs.name : name.trim(),
              symbol: typeof eventArgs?.symbol === 'string' ? eventArgs.symbol : ticker.trim(),
              description: story.trim(),
              creator: address as Address,
              poolAddress,
              quoteToken,
              quoteSymbol: resolvedQuoteSymbol,
              totalSupply: parsedTotalSupply,
              metadataURI: typeof eventArgs?.metadataURI === 'string' ? eventArgs.metadataURI : metadataUri,
              feeTier: readNumber(eventArgs?.fee) ?? feeTier,
              launchedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
            });
          }
        } catch {
          // Registration is retried client-side; if it still fails, background sync remains as a fallback.
        }
        try {
          await queueAutomaticVerification({
            chainKey,
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
  const launchFeeText = resolvedLaunchFeeWei !== undefined ? formatEther(resolvedLaunchFeeWei) : '—';
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
          <span className='max-w-[60%] truncate text-right text-[#f3f1e8]'>{resolvedPredictedTokenAddress ?? '—'}</span>
        </div>
        {feeTarget === 'holders' ? (
          <div className='flex items-center justify-between gap-4'>
            <span className='text-[#8f9482]'>{locale.distributor}</span>
            <span className='max-w-[60%] truncate text-right text-[#f3f1e8]'>{resolvedPredictedDistributorAddress ?? '—'}</span>
          </div>
        ) : null}
      </div>
      <p className='text-sm leading-7 text-[#8f9482]'>
        {!isConnected
          ? locale.walletRequired
          : isWrongNetwork
            ? locale.switchNetworkFirst
          : holderFeeUnsupported
            ? locale.robinhoodWalletFeesOnly
          : firstBuyUnsupported
            ? locale.robinhoodFirstBuyDisabled
          : launchFeeUnavailable
            ? locale.loadingLaunchFee
          : !name.trim() || !ticker.trim() || !resolvedQuoteToken || firstBuyAmount === undefined
            ? locale.missingFields
            : imageUploading
              ? locale.imageUploading
            : quotePriceLoading
              ? locale.loadingQuotePrice
            : quoteUsdPrice === undefined
              ? locale.quotePriceUnavailable
            : !metadataUri
              ? locale.metadataTooLarge
          : parsedTotalSupply === undefined || parsedInitialTick === undefined || parsedInitialBuyMinTokensOut === undefined || !tickAligned
            ? locale.invalidParams
          : feeTarget === 'holders' && !resolvedPredictedDistributorAddress
            ? locale.holdersPending
          : locale.launchReady}
      </p>
      {metadataCompacted && metadataUri ? (
        <p className='text-xs text-[#8f9482]'>{locale.metadataCompacted}</p>
      ) : null}
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
