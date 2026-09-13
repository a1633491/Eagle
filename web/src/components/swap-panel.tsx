'use client';

import { ArrowDownUp, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Address, formatUnits, isAddress, parseUnits } from 'viem';
import { useAccount, usePublicClient, useReadContract, useSendTransaction, useSwitchChain } from 'wagmi';
import { eagleErc20Abi } from '@/lib/contracts';
import { TokenDetail } from '@/lib/types';
import { currency } from '@/lib/format';
import { t, type Lang } from '@/lib/i18n';
import { buildUniswapSwap, checkUniswapApproval, getUniswapQuote, type UniswapQuoteResponse, type UniswapTransaction } from '@/lib/uniswap';
import { robinhoodChain } from '@/lib/robinhood-v4';

const robinhoodSwapCopy = {
  zh: {
    connectButton: '连接钱包',
    fetching: '正在获取 Uni v4 报价...',
    connected: 'Uni v4 实时报价',
    connectWallet: '连接钱包后查看 Uni v4 实时报价',
    wrongNetwork: '请先切到 Robinhood 链',
    switching: '正在切到 Robinhood 链...',
    approvalNeeded: '先授权代币，再完成兑换',
    approving: '正在提交授权...',
    approvalReady: '授权成功，再点一次即可兑换',
    cancelling: '正在重置旧授权...',
    building: '正在构建 Uni v4 交易...',
    swapping: '正在发送 Uni v4 交易...',
    swapped: 'Uni v4 交易已上链',
    comingSoon: '立即兑换',
  },
  en: {
    connectButton: 'Connect wallet',
    fetching: 'Fetching Uni v4 quote...',
    connected: 'Live Uni v4 quote',
    connectWallet: 'Connect wallet for a live Uni v4 quote',
    wrongNetwork: 'Switch to Robinhood first',
    switching: 'Switching to Robinhood...',
    approvalNeeded: 'Approve the token first, then swap',
    approving: 'Submitting approval...',
    approvalReady: 'Approval confirmed. Click once more to swap.',
    cancelling: 'Resetting previous approval...',
    building: 'Building Uni v4 swap...',
    swapping: 'Sending Uni v4 swap...',
    swapped: 'Uni v4 swap submitted',
    comingSoon: 'Swap now',
  },
  ja: {
    connectButton: 'ウォレット接続',
    fetching: 'Uni v4 の見積もりを取得中...',
    connected: 'Uni v4 のリアルタイム見積もり',
    connectWallet: 'ウォレット接続後に Uni v4 見積もりを表示',
    wrongNetwork: '先に Robinhood へ切り替えてください',
    switching: 'Robinhood へ切り替え中...',
    approvalNeeded: '先に承認してからスワップします',
    approving: '承認を送信中...',
    approvalReady: '承認完了。もう一度押すとスワップします。',
    cancelling: '古い承認をリセット中...',
    building: 'Uni v4 スワップを構築中...',
    swapping: 'Uni v4 スワップを送信中...',
    swapped: 'Uni v4 スワップを送信しました',
    comingSoon: '今すぐスワップ',
  },
} as const;

function toBigIntOrUndefined(value?: string) {
  if (!value) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function mapTransactionRequest(tx: UniswapTransaction) {
  const gas = toBigIntOrUndefined(tx.gasLimit);
  const value = toBigIntOrUndefined(tx.value) ?? BigInt(0);
  const gasPrice = toBigIntOrUndefined(tx.gasPrice);
  const maxFeePerGas = toBigIntOrUndefined(tx.maxFeePerGas);
  const maxPriorityFeePerGas = toBigIntOrUndefined(tx.maxPriorityFeePerGas);

  return {
    to: tx.to,
    data: tx.data,
    value,
    chainId: tx.chainId,
    ...(gas !== undefined ? { gas } : {}),
    ...(gasPrice !== undefined
      ? { gasPrice, type: 'legacy' as const }
      : {
          ...(maxFeePerGas !== undefined ? { maxFeePerGas } : {}),
          ...(maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas } : {}),
        }),
  };
}

export function SwapPanel({
  lang,
  token,
  creatorClaimableText,
}: {
  lang: Lang;
  token: TokenDetail;
  creatorClaimableText?: string;
}) {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const [pay, setPay] = useState('0.00');
  const [slippage] = useState('0.5');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');
  const [liveQuote, setLiveQuote] = useState<UniswapQuoteResponse>();
  const [quotedReceive, setQuotedReceive] = useState<string>();
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const isRobinhood = token.chainKey === 'robinhood';
  const isWrongNetwork = isRobinhood && isConnected && chainId !== undefined && chainId !== robinhoodChain.id;
  const quoteTokenAddress = token.quoteToken && isAddress(token.quoteToken) ? (token.quoteToken as Address) : undefined;
  const payTokenAddress = side === 'Buy' ? quoteTokenAddress : (token.address as Address);
  const receiveTokenAddress = side === 'Buy' ? (token.address as Address) : quoteTokenAddress;

  const { data: payTokenDecimals } = useReadContract({
    chainId: robinhoodChain.id,
    address: payTokenAddress,
    abi: eagleErc20Abi,
    functionName: 'decimals',
    query: {
      enabled: Boolean(isRobinhood && payTokenAddress),
    },
  });

  const { data: receiveTokenDecimals } = useReadContract({
    chainId: robinhoodChain.id,
    address: receiveTokenAddress,
    abi: eagleErc20Abi,
    functionName: 'decimals',
    query: {
      enabled: Boolean(isRobinhood && receiveTokenAddress),
    },
  });

  const fallbackReceive = useMemo(() => {
    const numericPay = Number(pay || 0);
    if (!numericPay || Number.isNaN(numericPay)) {
      return 0;
    }
    return side === 'Buy' ? numericPay / token.priceUsd : numericPay * token.priceUsd;
  }, [pay, side, token.priceUsd]);

  useEffect(() => {
    if (!isRobinhood) {
      setLiveQuote(undefined);
      setQuotedReceive(undefined);
      setQuoteError('');
      setQuoteLoading(false);
      return;
    }

    if (!isConnected || !address || !payTokenAddress || !receiveTokenAddress || !quoteTokenAddress) {
      setLiveQuote(undefined);
      setQuotedReceive(undefined);
      setQuoteError('');
      setQuoteLoading(false);
      return;
    }

    const decimalsIn = Number(payTokenDecimals ?? 18);
    const decimalsOut = Number(receiveTokenDecimals ?? 18);
    if (!pay || Number(pay) <= 0) {
      setLiveQuote(undefined);
      setQuotedReceive(undefined);
      setQuoteError('');
      setQuoteLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setQuoteLoading(true);
        setQuoteError('');
        const quote = await getUniswapQuote({
          chainKey: 'robinhood',
          swapper: address,
          tokenIn: payTokenAddress,
          tokenOut: receiveTokenAddress,
          amount: parseUnits(pay, decimalsIn).toString(),
          slippageTolerance: Number(slippage),
        });
        if (!cancelled) {
          setLiveQuote(quote);
        }
        const amountOut = quote.quote?.output?.amount;
        if (!cancelled && amountOut) {
          setQuotedReceive(Number(formatUnits(BigInt(amountOut), decimalsOut)).toFixed(6));
        }
      } catch (error) {
        if (!cancelled) {
          setLiveQuote(undefined);
          setQuotedReceive(undefined);
          setQuoteError(error instanceof Error ? error.message : 'Quote unavailable');
        }
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    address,
    isConnected,
    isRobinhood,
    pay,
    payTokenAddress,
    payTokenDecimals,
    quoteTokenAddress,
    receiveTokenAddress,
    receiveTokenDecimals,
    side,
    slippage,
  ]);

  const paySymbol = side === 'Buy' ? token.quoteSymbol : token.symbol;
  const receiveSymbol = side === 'Buy' ? token.symbol : token.quoteSymbol;
  const actionCopy = robinhoodSwapCopy[lang];
  const receiveNote =
    isRobinhood
      ? quoteError
        ? quoteError
        : quoteLoading
          ? actionCopy.fetching
          : isConnected
            ? actionCopy.connected
            : actionCopy.connectWallet
      : side === 'Buy'
        ? `${currency(token.priceUsd)} / token`
        : `${currency(token.priceUsd)} per ${token.symbol}`;
  const receiveValue = quotedReceive ?? (fallbackReceive ? fallbackReceive.toFixed(2) : '0.00');

  async function submitUniswapTransaction(tx: UniswapTransaction) {
    if (!sendTransactionAsync || !publicClient) {
      throw new Error('Wallet transaction is unavailable');
    }

    const hash = await sendTransactionAsync(mapTransactionRequest(tx));
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function handleRobinhoodSwap() {
    if (!isConnected || !address) {
      setActionStatus(actionCopy.connectWallet);
      return;
    }

    if (isWrongNetwork) {
      if (!switchChainAsync) {
        setActionStatus(actionCopy.wrongNetwork);
        return;
      }
      try {
        setActionBusy(true);
        setActionStatus(actionCopy.switching);
        await switchChainAsync({ chainId: robinhoodChain.id });
        setActionStatus('');
      } catch (error) {
        setActionStatus(error instanceof Error ? error.message : actionCopy.wrongNetwork);
      } finally {
        setActionBusy(false);
      }
      return;
    }

    if (!payTokenAddress || !receiveTokenAddress || !liveQuote || !pay || Number(pay) <= 0) {
      setActionStatus(quoteError || actionCopy.fetching);
      return;
    }

    const amountIn = (() => {
      try {
        return parseUnits(pay, Number(payTokenDecimals ?? 18)).toString();
      } catch {
        return null;
      }
    })();

    if (!amountIn) {
      setActionStatus(quoteError || actionCopy.fetching);
      return;
    }

    try {
      setActionBusy(true);
      setActionStatus(actionCopy.approvalNeeded);
      const approval = await checkUniswapApproval({
        chainKey: 'robinhood',
        swapper: address,
        tokenIn: payTokenAddress,
        tokenOut: receiveTokenAddress,
        amount: amountIn,
        slippageTolerance: Number(slippage),
      });

      if (approval.cancel) {
        setActionStatus(actionCopy.cancelling);
        await submitUniswapTransaction(approval.cancel);
        setActionStatus(actionCopy.approvalReady);
        return;
      }

      if (approval.approval) {
        setActionStatus(actionCopy.approving);
        await submitUniswapTransaction(approval.approval);
        setActionStatus(actionCopy.approvalReady);
        return;
      }

      setActionStatus(actionCopy.building);
      const swap = await buildUniswapSwap(liveQuote);
      setActionStatus(actionCopy.swapping);
      await submitUniswapTransaction(swap.swap);
      setActionStatus(actionCopy.swapped);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : 'Swap failed');
    } finally {
      setActionBusy(false);
    }
  }

  const primaryLabel = isRobinhood
    ? !isConnected
      ? actionCopy.connectButton
      : isWrongNetwork
        ? actionCopy.wrongNetwork
        : quoteLoading
          ? actionCopy.fetching
          : actionCopy.comingSoon
    : side === 'Buy'
      ? t(lang, 'buy')
      : t(lang, 'sell');

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
        value={receiveValue}
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
      {isRobinhood && actionStatus ? <p className="mt-3 text-xs text-[#d8c483]">{actionStatus}</p> : null}
      <button
        type="button"
        onClick={isRobinhood ? handleRobinhoodSwap : undefined}
        disabled={isRobinhood ? actionBusy : false}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-[#f6e3ac55] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] text-sm font-medium text-[#342d1a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {actionBusy ? '...' : primaryLabel}
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
