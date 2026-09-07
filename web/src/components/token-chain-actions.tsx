'use client';

import { useMemo, useState } from 'react';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { type Address, formatUnits, isAddress, parseUnits, zeroAddress } from 'viem';
import { shorten } from '@/lib/format';
import {
  eagleContracts,
  eagleDistributorFactoryAbi,
  eagleErc20Abi,
  eagleFactoryAbi,
  eagleLiquidityLockerAbi,
} from '@/lib/contracts';
import { type Lang } from '@/lib/i18n';

const copy = {
  zh: {
    title: '链上操作',
    subtitle: '直接调用你刚部署的 Eagle 合约。',
    connectWallet: '先连接钱包',
    launchStatus: '工厂登记状态',
    launched: '已在 EagleFactory 登记',
    notLaunched: '当前代币不在 EagleFactory 发射记录里',
    quoteToken: '配对代币',
    creator: '创建者',
    claimable: '我的可领取费用',
    distributor: '持有人分发合约',
    predictedDistributor: '预计分发地址',
    collectFees: '收集全部费用',
    claimFees: '领取我的费用',
    distribute: '分发给持有人',
    minTokensOut: '最少买回数量',
    waiting: '等待钱包确认...',
    collectDone: '费用已收集。',
    claimDone: '费用已领取。',
    distributeDone: '已完成分发。',
    failedPrefix: '交易失败：',
    noQuoteToken: '暂时还读不到配对代币。',
  },
  en: {
    title: 'On-chain actions',
    subtitle: 'Call the live Eagle contracts directly.',
    connectWallet: 'Connect wallet first',
    launchStatus: 'Factory registry',
    launched: 'Registered in EagleFactory',
    notLaunched: 'This token is not registered in EagleFactory',
    quoteToken: 'Quote token',
    creator: 'Creator',
    claimable: 'My claimable fees',
    distributor: 'Holder distributor',
    predictedDistributor: 'Predicted distributor',
    collectFees: 'Collect all fees',
    claimFees: 'Claim my fees',
    distribute: 'Distribute to holders',
    minTokensOut: 'Minimum buyback output',
    waiting: 'Waiting for wallet confirmation...',
    collectDone: 'Fees collected.',
    claimDone: 'Fees claimed.',
    distributeDone: 'Distribution completed.',
    failedPrefix: 'Transaction failed: ',
    noQuoteToken: 'Quote token is not available yet.',
  },
  ja: {
    title: 'オンチェーン操作',
    subtitle: 'いま動いている Eagle コントラクトを直接呼び出します。',
    connectWallet: '先にウォレットを接続',
    launchStatus: 'Factory 登録状態',
    launched: 'EagleFactory に登録済み',
    notLaunched: 'このトークンは EagleFactory に登録されていません',
    quoteToken: 'ペアトークン',
    creator: '作成者',
    claimable: '自分の請求可能手数料',
    distributor: '保有者分配コントラクト',
    predictedDistributor: '予定分配アドレス',
    collectFees: '全手数料を回収',
    claimFees: '自分の手数料を請求',
    distribute: '保有者へ分配',
    minTokensOut: '最小買い戻し数量',
    waiting: 'ウォレット確認待ち...',
    collectDone: '手数料を回収しました。',
    claimDone: '手数料を請求しました。',
    distributeDone: '分配が完了しました。',
    failedPrefix: '取引失敗: ',
    noQuoteToken: 'ペアトークンをまだ取得できません。',
  },
} as const;

function normalizeError(error: unknown, prefix: string) {
  if (error instanceof Error && error.message) {
    return `${prefix}${error.message}`;
  }
  return `${prefix}Unknown error`;
}

export function TokenChainActions({ lang, tokenAddress }: { lang: Lang; tokenAddress: string }) {
  const locale = copy[lang];
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [busyAction, setBusyAction] = useState<'collect' | 'claim' | 'distribute' | null>(null);
  const [status, setStatus] = useState('');
  const [minTokensOut, setMinTokensOut] = useState('0');

  const normalizedToken = isAddress(tokenAddress) ? (tokenAddress as Address) : undefined;

  const { data: launchRecord } = useReadContract({
    address: eagleContracts.factory,
    abi: eagleFactoryAbi,
    functionName: 'launches',
    args: normalizedToken ? [normalizedToken] : undefined,
    query: {
      enabled: Boolean(normalizedToken),
    },
  });

  const quoteToken = launchRecord?.[1];
  const creator = launchRecord?.[3];
  const pool = launchRecord?.[2];
  const isLaunched = Boolean(pool && pool !== zeroAddress);

  const { data: distributorOf } = useReadContract({
    address: eagleContracts.distributorFactory,
    abi: eagleDistributorFactoryAbi,
    functionName: 'distributorOf',
    args: normalizedToken ? [normalizedToken] : undefined,
    query: {
      enabled: Boolean(normalizedToken),
    },
  });

  const { data: predictedDistributor } = useReadContract({
    address: eagleContracts.distributorFactory,
    abi: eagleDistributorFactoryAbi,
    functionName: 'predict',
    args: normalizedToken ? [normalizedToken] : undefined,
    query: {
      enabled: Boolean(normalizedToken),
    },
  });

  const { data: quoteDecimals } = useReadContract({
    address: quoteToken,
    abi: eagleErc20Abi,
    functionName: 'decimals',
    query: {
      enabled: Boolean(quoteToken),
    },
  });

  const { data: quoteSymbol } = useReadContract({
    address: quoteToken,
    abi: eagleErc20Abi,
    functionName: 'symbol',
    query: {
      enabled: Boolean(quoteToken),
    },
  });

  const { data: claimableFees } = useReadContract({
    address: eagleContracts.locker,
    abi: eagleLiquidityLockerAbi,
    functionName: 'claimableFees',
    args: address && quoteToken ? [address, quoteToken] : undefined,
    query: {
      enabled: Boolean(address && quoteToken),
    },
  });

  const claimableText = useMemo(() => {
    if (!quoteToken) return locale.noQuoteToken;
    return `${formatUnits(claimableFees ?? BigInt(0), Number(quoteDecimals ?? 18))} ${quoteSymbol ?? ''}`.trim();
  }, [claimableFees, locale.noQuoteToken, quoteDecimals, quoteSymbol, quoteToken]);

  const parsedMinTokensOut = useMemo(() => {
    try {
      return minTokensOut ? parseUnits(minTokensOut, 18) : BigInt(0);
    } catch {
      return undefined;
    }
  }, [minTokensOut]);

  async function runAction(
    action: 'collect' | 'claim' | 'distribute',
    fn: () => Promise<void>,
    successMessage: string,
  ) {
    try {
      setBusyAction(action);
      setStatus(locale.waiting);
      await fn();
      setStatus(successMessage);
    } catch (error) {
      setStatus(normalizeError(error, locale.failedPrefix));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCollect() {
    if (!normalizedToken || !publicClient) return;
    await runAction(
      'collect',
      async () => {
        const hash = await writeContractAsync({
          address: eagleContracts.locker,
          abi: eagleLiquidityLockerAbi,
          functionName: 'collectAllFees',
          args: [normalizedToken],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      },
      locale.collectDone,
    );
  }

  async function handleClaim() {
    if (!quoteToken || !address || !publicClient) return;
    await runAction(
      'claim',
      async () => {
        const hash = await writeContractAsync({
          address: eagleContracts.locker,
          abi: eagleLiquidityLockerAbi,
          functionName: 'claimFees',
          args: [quoteToken, address],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      },
      locale.claimDone,
    );
  }

  async function handleDistribute() {
    if (!normalizedToken || parsedMinTokensOut === undefined || !publicClient) return;
    await runAction(
      'distribute',
      async () => {
        const hash = await writeContractAsync({
          address: eagleContracts.distributorFactory,
          abi: eagleDistributorFactoryAbi,
          functionName: 'distribute',
          args: [normalizedToken, parsedMinTokensOut],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      },
      locale.distributeDone,
    );
  }

  return (
    <div className='rounded-[24px] border border-white/8 bg-[#1a1c19]/96 p-5'>
      <div className='mb-4'>
        <h2 className='text-lg font-semibold text-[#f3f1e8]'>{locale.title}</h2>
        <p className='mt-1 text-sm text-[#9da28f]'>{locale.subtitle}</p>
      </div>
      <div className='rounded-[18px] border border-white/8 bg-[#131512] p-4 text-sm text-[#a8ad99]'>
        <div className='flex items-center justify-between gap-3'>
          <span>{locale.launchStatus}</span>
          <span className={isLaunched ? 'text-[#8fd19e]' : 'text-[#e28989]'}>
            {isLaunched ? locale.launched : locale.notLaunched}
          </span>
        </div>
        <div className='mt-3 flex items-center justify-between gap-3'>
          <span>{locale.quoteToken}</span>
          <span className='max-w-[58%] truncate text-right text-[#f3f1e8]'>
            {quoteToken ? `${quoteSymbol ?? ''} ${shorten(quoteToken)}`.trim() : '—'}
          </span>
        </div>
        <div className='mt-3 flex items-center justify-between gap-3'>
          <span>{locale.creator}</span>
          <span className='text-[#f3f1e8]'>{creator ? shorten(creator) : '—'}</span>
        </div>
        <div className='mt-3 flex items-center justify-between gap-3'>
          <span>{locale.claimable}</span>
          <span className='text-right text-[#f3f1e8]'>{claimableText}</span>
        </div>
        <div className='mt-3 flex items-center justify-between gap-3'>
          <span>{locale.distributor}</span>
          <span className='text-right text-[#f3f1e8]'>
            {distributorOf && distributorOf !== zeroAddress ? shorten(distributorOf) : '—'}
          </span>
        </div>
        <div className='mt-2 flex items-center justify-between gap-3 text-xs text-[#8f9482]'>
          <span>{locale.predictedDistributor}</span>
          <span>{predictedDistributor ? shorten(predictedDistributor) : '—'}</span>
        </div>
      </div>
      <div className='mt-4 space-y-3'>
        <button
          type='button'
          onClick={handleCollect}
          disabled={!normalizedToken || !isConnected || !isLaunched || busyAction !== null}
          className='inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-transparent text-sm font-medium text-[#c5c9bc] transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60'
        >
          {busyAction === 'collect' ? '...' : isConnected ? locale.collectFees : locale.connectWallet}
        </button>
        <button
          type='button'
          onClick={handleClaim}
          disabled={!quoteToken || !isConnected || !isLaunched || busyAction !== null}
          className='inline-flex h-11 w-full items-center justify-center rounded-full border border-[#e8d79f2f] bg-[#ffffff05] text-sm font-medium text-[#f1e4b7] transition hover:bg-[#ffffff08] disabled:cursor-not-allowed disabled:opacity-60'
        >
          {busyAction === 'claim' ? '...' : isConnected ? locale.claimFees : locale.connectWallet}
        </button>
        <div className='rounded-[18px] border border-white/8 bg-[#131512] p-3'>
          <div className='mb-2 flex items-center justify-between text-xs text-[#8f9482]'>
            <span>{locale.minTokensOut}</span>
            <span>18 decimals</span>
          </div>
          <input
            value={minTokensOut}
            onChange={(event) => setMinTokensOut(event.target.value)}
            className='w-full bg-transparent text-lg font-semibold text-[#f3f1e8] outline-none'
          />
        </div>
        <button
          type='button'
          onClick={handleDistribute}
          disabled={!normalizedToken || !isConnected || !isLaunched || parsedMinTokensOut === undefined || busyAction !== null}
          className='inline-flex h-11 w-full items-center justify-center rounded-full border border-[#f6e3ac55] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] text-sm font-medium text-[#342d1a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {busyAction === 'distribute' ? '...' : isConnected ? locale.distribute : locale.connectWallet}
        </button>
      </div>
      {status ? <p className='mt-4 text-sm text-[#d8c483]'>{status}</p> : null}
    </div>
  );
}
