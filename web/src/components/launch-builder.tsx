'use client';

import { ChevronDown, Globe, ImagePlus, Link2, MessageCircle, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useReadContract } from 'wagmi';
import { isAddress } from 'viem';
import { LaunchSubmitActions } from '@/components/launch-submit-actions';
import { getChainConfig, type ChainKey } from '@/lib/chains';
import { eagleErc20Abi } from '@/lib/contracts';
import { t, type Lang } from '@/lib/i18n';

const pairOptions = [
  { key: 'BNB', label: 'BNB', subtitle: 'Native', icon: '◆' },
  { key: 'USDT', label: 'USDT', subtitle: 'Stable', icon: '₮' },
  { key: 'ANY', label: 'Any BSC token', subtitle: '', icon: '' },
] as const;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

const copy = {
  zh: {
    native: '原生',
    stable: '稳定币',
    storyPlaceholder: '这是什么想法？给未来社区讲讲你的代币故事。',
    imageFormats: 'PNG, JPG, GIF, WebP · 5 MB',
    tokenNamePlaceholder: '代币名称',
    tickerPlaceholder: '代码',
    tradingPair: '交易对',
    chainMainnet: 'BNB Smart Chain 主网 Chain 56',
    creatorFees: '创作者费用',
    feeTargetHint: '选择让创作者费用由钱包领取，或流向持有人奖励。',
    firstPurchaseHint: '可在创建交易里用所选配对资产完成一笔可选首购。',
    feeRecipientPlaceholder: '0x... 手续费接收钱包',
    yourTokenName: '你的代币名称',
    previewStory: '一个新想法，一个新社区，一切从这里开始。',
    builtForCreators: '为创作者打造。',
    poweredByBnbChain: '由 BNB Chain 驱动。',
    holders: '持有人',
    totalSupply: '总供应量',
    totalSupplyHint: 'zero 默认使用 18 位精度，输入不带小数的总代币数量。',
    feeTier: '池子费率档位',
    feeTierHint: '必须是 Pancake V3 支持的档位，影响流动性池交易费。',
    initialTick: '初始价格 Tick',
    initialTickHint: '决定初始价格与市值，必须满足当前费率档位的 tick spacing。',
    slippageGuard: '首购保护',
    slippageGuardHint: '设置首购最少收到的代币数量，防止首购被夹击时滑点过大。',
    tickSpacing: 'Tick spacing',
    advancedSettings: '高级参数',
    advancedHint: '默认值已可直接发射，需要更细控制时再展开。',
    advancedSummary: '已使用高级发射参数',
    websiteLabel: '网站',
    websitePlaceholder: 'https://your-site.com',
    xLabel: 'X',
    xPlaceholder: 'https://x.com/yourproject',
    telegramLabel: 'Telegram',
    telegramPlaceholder: 'https://t.me/yourproject',
    quoteTokenPlaceholder: '输入 BSC 代币合约地址',
    quoteTokenDetected: '已识别配对币',
    quoteTokenInvalid: '请输入有效的 BSC BEP20 合约地址',
    pageEyebrow: 'Launch dApp',
    pageTitle: '用更清晰的双栏创建页，把代币发射前的样子先搭出来。',
    pageSubtitle: '左边填写代币资料与发射参数，右边实时看到预上线卡片效果。',
    required: '必填',
    socialLinks: '社交链接',
    poolMode: '池子模式',
    singlePool: '单池',
    multiPool: '多池',
    pairAsset: '交易对资产',
    networkHintLabel: '发射网络',
    previewCardHint: '这里模拟的是代币上线前的预览卡片。',
    previewStatus: '状态',
    realtimePreview: '你在表单里输入的内容会实时同步到这里。',
    dragAndDrop: '拖拽图片到这里，或点击上传',
    dropHint: 'PNG, JPG, GIF, WebP · 5MB 上限',
    creatorFeeWallet: '创作者费用接收地址',
    firstBuyOptional: '首购金额',
    firstBuyOptionalHint: '非必填，不填时会按 0 处理。',
    reviewSummary: '创建前检查',
    reviewSummaryHint: '提交前检查名称、交易对、网络和创作者设置是否正确。',
    previewChain: '链网络',
    previewPair: '交易对',
    previewPoolMode: '池子结构',
    tokenStoryLabel: 'Story',
    livePreviewPanel: 'LIVE PREVIEW',
    linksReady: '链接已填写',
    noLinksYet: '暂未填写链接',
  },
  en: {
    native: 'Native',
    stable: 'Stable',
    storyPlaceholder: "What's the idea? Tell your future community a little about your token.",
    imageFormats: 'PNG, JPG, GIF, WebP · 5 MB',
    tokenNamePlaceholder: 'Token Name',
    tickerPlaceholder: 'TICKER',
    tradingPair: 'Trading pair',
    chainMainnet: 'BNB Smart Chain mainnet Chain 56',
    creatorFees: 'Creator fees',
    feeTargetHint: 'Choose whether creator fees stay claimable by a wallet or route into holder rewards.',
    firstPurchaseHint: 'Add an optional buy in the launch transaction using your chosen pair.',
    feeRecipientPlaceholder: '0x... fee recipient',
    yourTokenName: 'Your token name',
    previewStory: 'A new idea. A new community. It all starts here.',
    builtForCreators: 'Built for creators.',
    poweredByBnbChain: 'Powered by BNB Chain.',
    holders: 'Holders',
    totalSupply: 'Total supply',
    totalSupplyHint: 'zero uses 18 decimals by default. Enter the total token amount without decimals.',
    feeTier: 'Pool fee tier',
    feeTierHint: 'Must be a Pancake V3 supported tier and affects the swap fee on your pool.',
    initialTick: 'Initial price tick',
    initialTickHint: 'Sets the opening price and market cap. It must respect the tier tick spacing.',
    slippageGuard: 'First buy protection',
    slippageGuardHint: 'Set the minimum amount of launched tokens the first buy must receive.',
    tickSpacing: 'Tick spacing',
    advancedSettings: 'Advanced settings',
    advancedHint: 'The defaults are launch-ready. Expand only when you need finer control.',
    advancedSummary: 'Advanced launch parameters enabled',
    websiteLabel: 'Website',
    websitePlaceholder: 'https://your-site.com',
    xLabel: 'X',
    xPlaceholder: 'https://x.com/yourproject',
    telegramLabel: 'Telegram',
    telegramPlaceholder: 'https://t.me/yourproject',
    quoteTokenPlaceholder: 'Enter a BSC token contract address',
    quoteTokenDetected: 'Detected quote token',
    quoteTokenInvalid: 'Enter a valid BSC BEP20 contract address',
    pageEyebrow: 'Launch dApp',
    pageTitle: 'Shape the token page first, then launch it with confidence.',
    pageSubtitle: 'Build everything on the left and watch the live pre-launch card update on the right.',
    required: 'Required',
    socialLinks: 'Social links',
    poolMode: 'Pool mode',
    singlePool: 'Single pool',
    multiPool: 'Multi pool',
    pairAsset: 'Pair asset',
    networkHintLabel: 'Launch network',
    previewCardHint: 'This is how your token card looks before it goes live.',
    previewStatus: 'Status',
    realtimePreview: 'Everything you enter in the form appears here in real time.',
    dragAndDrop: 'Drag your artwork here or upload it',
    dropHint: 'PNG, JPG, GIF, WebP · 5 MB max',
    creatorFeeWallet: 'Creator fee recipient',
    firstBuyOptional: 'First buy amount',
    firstBuyOptionalHint: 'Optional. Leave it at 0 if you do not want an initial buy.',
    reviewSummary: 'Before-you-launch summary',
    reviewSummaryHint: 'Double-check the token name, pair, network, and creator settings before you submit.',
    previewChain: 'Chain',
    previewPair: 'Pair',
    previewPoolMode: 'Pool layout',
    tokenStoryLabel: 'Story',
    livePreviewPanel: 'LIVE PREVIEW',
    linksReady: 'Links ready',
    noLinksYet: 'No links yet',
  },
  ja: {
    native: 'ネイティブ',
    stable: 'ステーブル',
    storyPlaceholder: 'どんなアイデアですか？ 未来のコミュニティにトークンの物語を伝えましょう。',
    imageFormats: 'PNG, JPG, GIF, WebP · 5 MB',
    tokenNamePlaceholder: 'トークン名',
    tickerPlaceholder: 'TICKER',
    tradingPair: '取引ペア',
    chainMainnet: 'BNB Smart Chain メインネット Chain 56',
    creatorFees: 'クリエイター手数料',
    feeTargetHint: 'クリエイター手数料をウォレットで受け取るか、保有者報酬に回すかを選択します。',
    firstPurchaseHint: '選択したペア資産で、ローンチ取引に任意の初回購入を追加できます。',
    feeRecipientPlaceholder: '0x... 手数料受取先',
    yourTokenName: 'あなたのトークン名',
    previewStory: '新しいアイデア。新しいコミュニティ。すべてはここから始まります。',
    builtForCreators: 'クリエイターのために。',
    poweredByBnbChain: 'BNB Chain powered。',
    holders: '保有者',
    totalSupply: '総供給量',
    totalSupplyHint: 'zero は標準で 18 decimals を使います。小数なしの総数量を入力してください。',
    feeTier: 'プール手数料ティア',
    feeTierHint: 'Pancake V3 が対応するティアのみ使用できます。プールの手数料率に影響します。',
    initialTick: '初期価格 Tick',
    initialTickHint: '初期価格と時価総額を決めます。選択したティアの tick spacing に従う必要があります。',
    slippageGuard: '初回購入保護',
    slippageGuardHint: '初回購入で最低限受け取るトークン数量を設定します。',
    tickSpacing: 'Tick spacing',
    advancedSettings: '詳細設定',
    advancedHint: 'デフォルト値のままでローンチできます。細かく調整したい時だけ開いてください。',
    advancedSummary: '詳細なローンチ設定を使用中',
    websiteLabel: 'Website',
    websitePlaceholder: 'https://your-site.com',
    xLabel: 'X',
    xPlaceholder: 'https://x.com/yourproject',
    telegramLabel: 'Telegram',
    telegramPlaceholder: 'https://t.me/yourproject',
    quoteTokenPlaceholder: 'BSC トークンコントラクトアドレスを入力',
    quoteTokenDetected: '認識したペアトークン',
    quoteTokenInvalid: '有効な BSC BEP20 コントラクトアドレスを入力してください',
    pageEyebrow: 'Launch dApp',
    pageTitle: 'Create a token page that feels ready before it goes live.',
    pageSubtitle: '左側で内容を整え、右側で公開前カードをリアルタイムに確認できます。',
    required: '必須',
    socialLinks: 'ソーシャルリンク',
    poolMode: 'プールモード',
    singlePool: '単一プール',
    multiPool: '複数プール',
    pairAsset: 'ペア資産',
    networkHintLabel: 'ローンチ先ネットワーク',
    previewCardHint: '公開前に表示されるカードの見え方です。',
    previewStatus: 'ステータス',
    realtimePreview: 'フォーム内容がここにそのまま反映されます。',
    dragAndDrop: '画像をここへドラッグするか、アップロードしてください',
    dropHint: 'PNG, JPG, GIF, WebP・最大 5MB',
    creatorFeeWallet: 'クリエイター手数料受取先',
    firstBuyOptional: '初回購入額',
    firstBuyOptionalHint: '必要な場合のみ入力してください。空なら 0 のままです。',
    reviewSummary: 'ローンチ前サマリー',
    reviewSummaryHint: '送信前に名前、取引ペア、ネットワーク、クリエイター設定を確認してください。',
    previewChain: 'チェーン',
    previewPair: '取引ペア',
    previewPoolMode: 'プール構成',
    tokenStoryLabel: 'Story',
    livePreviewPanel: 'LIVE PREVIEW',
    linksReady: 'Links ready',
    noLinksYet: 'No links yet',
  },
} as const;

const NAME_MAX = 32;
const STORY_MAX = 1000;
const URL_MAX = 120;
const ADDRESS_MAX = 42;

function SectionHeading({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className='mb-8 flex items-start gap-4 sm:gap-5'>
      <div className='text-[2.2rem] font-semibold leading-none tracking-[-0.08em] text-[#f3f1e8] sm:text-[2.9rem]'>
        {step}
      </div>
      <div className='pt-1'>
        <h2 className='text-[1.35rem] font-semibold tracking-[-0.05em] text-[#f3f1e8] sm:text-[1.65rem]'>{title}</h2>
        <p className='mt-2 max-w-2xl text-sm leading-7 text-[#8e9488]'>{description}</p>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  count,
  max,
}: {
  label: string;
  required?: boolean;
  count?: number;
  max?: number;
}) {
  return (
    <div className='mb-2.5 flex items-center justify-between gap-3'>
      <label className='text-sm font-medium text-[#f3f1e8]'>
        {label}
        {required ? <span className='ml-1 text-[#f1e4b7]'>*</span> : null}
      </label>
      {typeof count === 'number' && typeof max === 'number' ? (
        <span className='text-xs tabular-nums text-[#737a6d]'>
          {count}/{max}
        </span>
      ) : null}
    </div>
  );
}

export function LaunchBuilder({ lang, chainKey }: { lang: Lang; chainKey: ChainKey }) {
  const chain = getChainConfig(chainKey);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [story, setStory] = useState('');
  const [poolMode, setPoolMode] = useState<'single' | 'multi'>('single');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [pair, setPair] = useState<(typeof pairOptions)[number]['key']>('BNB');
  const [feeTarget, setFeeTarget] = useState<'wallet' | 'holders'>('wallet');
  const [firstBuy, setFirstBuy] = useState('0.00');
  const [feeWallet, setFeeWallet] = useState('');
  const [quoteTokenInput, setQuoteTokenInput] = useState('');
  const [totalSupply] = useState('1000000000');
  const [feeTier] = useState<100 | 500 | 2500 | 10000>(10000);
  const [initialBuyMinTokensOut] = useState('0');
  const resolvedCustomQuoteToken = pair === 'ANY' && isAddress(quoteTokenInput) ? quoteTokenInput : undefined;

  const { data: customQuoteSymbol } = useReadContract({
    chainId: chain.chainId,
    address: resolvedCustomQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'symbol',
    query: {
      enabled: Boolean(resolvedCustomQuoteToken),
    },
  });

  const { data: customQuoteName } = useReadContract({
    chainId: chain.chainId,
    address: resolvedCustomQuoteToken,
    abi: eagleErc20Abi,
    functionName: 'name',
    query: {
      enabled: Boolean(resolvedCustomQuoteToken),
    },
  });

  const pairLabel = useMemo(() => {
    if (pair === 'USDT') return chain.stableSymbol;
    if (pair === 'ANY') return customQuoteSymbol ?? 'TOKEN';
    return chain.nativeSymbol;
  }, [chain.nativeSymbol, chain.stableSymbol, customQuoteSymbol, pair]);

  const locale = copy[lang];
  const feeTargetLabel = feeTarget === 'wallet' ? t(lang, 'feeWallet') : locale.holders;
  const localizedPairOptions = pairOptions
    .filter((option) => !(option.key === 'USDT' && chain.stableToken.toLowerCase() === chain.wrappedNativeToken.toLowerCase()))
    .map((option) => ({
      ...option,
      label: option.key === 'ANY' ? chain.anyTokenLabel : option.key === 'BNB' ? chain.nativeSymbol : chain.stableSymbol,
      subtitle: option.key === 'BNB' ? locale.native : option.key === 'USDT' ? locale.stable : option.subtitle,
    }));
  const chainMainnetLabel = `${chain.name} mainnet Chain ${chain.chainId}`;
  const reviewRows = [
    { label: t(lang, 'tokenName'), value: name || locale.tokenNamePlaceholder },
    { label: t(lang, 'ticker'), value: `$${ticker || 'TICKER'}` },
    { label: locale.previewPair, value: `${ticker || 'TICKER'} / ${pairLabel}` },
    { label: locale.previewChain, value: chainMainnetLabel },
    { label: locale.previewPoolMode, value: poolMode === 'single' ? locale.singlePool : locale.multiPool },
    { label: locale.creatorFees, value: feeTargetLabel },
  ];
  const socialReadyText = [websiteUrl, twitterUrl, telegramUrl].filter(Boolean).length
    ? [websiteUrl && locale.websiteLabel, twitterUrl && locale.xLabel, telegramUrl && locale.telegramLabel].filter(Boolean).join(' / ')
    : locale.noLinksYet;

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    readImageFile(file);
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/uploads/token-image`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`上传失败 (${response.status})`);
    }

    const payload = (await response.json()) as {
      code: number;
      data?: { imageUrl?: string };
      msg?: string;
    };

    if (!payload.data?.imageUrl) {
      throw new Error(payload.msg || '上传失败');
    }

    return payload.data.imageUrl;
  }

  function readImageFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      setImageError(lang === 'zh' ? '仅支持 PNG、JPG、GIF、WebP' : lang === 'ja' ? 'PNG、JPG、GIF、WebP のみ対応です' : 'Only PNG, JPG, GIF, and WebP are supported');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError(lang === 'zh' ? '图片不能超过 5 MB' : lang === 'ja' ? '画像は 5 MB 以下にしてください' : 'Images must be 5 MB or smaller');
      return;
    }

    setImagePreviewUrl(URL.createObjectURL(file));
    setImageFileName(file.name);
    setImageError('');
    setImageUploading(true);
    setImageUrl('');

    uploadImage(file)
      .then((nextImageUrl) => {
        setImageUrl(nextImageUrl);
        setImageError('');
      })
      .catch((error) => {
        setImageUrl('');
        setImageError(error instanceof Error ? error.message : '图片上传失败，请重试');
      })
      .finally(() => {
        setImageUploading(false);
      });
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    readImageFile(file);
  }

  return (
    <div className='space-y-8'>
      <div className='space-y-6'>
        <div className='max-w-4xl space-y-3'>
          <p className='text-[11px] font-medium uppercase tracking-[0.22em] text-[#7f8779]'>{locale.pageEyebrow}</p>
          <h1 className='max-w-4xl text-[2.2rem] font-semibold tracking-[-0.07em] text-[#f3f1e8] sm:text-[3rem]'>
            {locale.pageTitle}
          </h1>
          <p className='max-w-3xl text-[15px] leading-8 text-[#8e9488]'>{locale.pageSubtitle}</p>
        </div>

        <div className='grid gap-3 md:grid-cols-3'>
          {[
            ['01', t(lang, 'makeItYours')],
            ['02', t(lang, 'setYourLaunch')],
            ['03', t(lang, 'reviewAndCreate')],
          ].map(([step, label], index) => (
            <div
              key={step}
              className={`rounded-[24px] border px-5 py-4 ${
                index === 0 ? 'border-[#f1e4b733] bg-[#191c19]' : 'border-white/8 bg-[#151815]'
              }`}
            >
              <div className='text-[2rem] font-semibold tracking-[-0.08em] text-[#f3f1e8]'>{step}</div>
              <div className='mt-3 text-sm font-medium text-[#c8cebf]'>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className='grid gap-8 xl:grid-cols-[minmax(0,58fr)_minmax(340px,42fr)]'>
        <section className='min-w-0 space-y-8'>
          <div id='story' className='rounded-[30px] border border-white/8 bg-[#171a17] p-5 sm:p-7'>
            <SectionHeading step='01' title={t(lang, 'startWithStory')} description={t(lang, 'everyCommunityStarts')} />

            <div className='space-y-7'>
              <div>
                <FieldLabel label={t(lang, 'addTokenImage')} required />
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`rounded-[24px] border border-dashed p-5 transition sm:p-6 ${
                    isDragActive ? 'border-[#f1e4b766] bg-[#1b201c]' : 'border-white/12 bg-[#111410]'
                  }`}
                >
                  <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='flex min-w-0 items-center gap-4'>
                      {imagePreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imagePreviewUrl} alt='Token preview' className='h-16 w-16 rounded-[18px] border border-white/10 object-cover' />
                      ) : (
                        <div className='flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/10 bg-[#171b17] text-[#f1e4b7]'>
                          <ImagePlus className='h-6 w-6' />
                        </div>
                      )}
                      <div className='min-w-0'>
                        <p className='text-sm font-medium text-[#f3f1e8]'>{locale.dragAndDrop}</p>
                        <p className='mt-1 text-xs text-[#737a6d]'>{locale.dropHint}</p>
                        <p className='mt-2 truncate text-xs text-[#8e9488]'>{imageFileName || t(lang, 'noFileChosen')}</p>
                      </div>
                    </div>

                    <button
                      type='button'
                      onClick={() => fileInputRef.current?.click()}
                      className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-white/10 bg-[#1c201c] px-4 text-sm text-[#f1e4b7] transition hover:bg-[#202520] sm:w-auto'
                    >
                      <Upload className='h-4 w-4' />
                      {t(lang, 'chooseFile')}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/png,image/jpeg,image/gif,image/webp'
                    onChange={handleImageChange}
                    className='hidden'
                  />
                  {imageUploading ? <p className='mt-4 text-xs text-[#d8c483]'>{lang === 'zh' ? '图片上传中...' : lang === 'ja' ? '画像をアップロード中...' : 'Uploading image...'}</p> : null}
                  {imageError ? <p className='mt-4 text-xs text-[#f87171]'>{imageError}</p> : null}
                </div>
              </div>

              <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]'>
                <div>
                  <FieldLabel label={t(lang, 'tokenName')} required count={name.length} max={NAME_MAX} />
                  <input
                    id='token-name'
                    value={name}
                    maxLength={NAME_MAX}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={locale.tokenNamePlaceholder}
                    className='h-12 w-full rounded-[18px] border border-white/8 bg-[#111410] px-4 text-sm text-[#f3f1e8] outline-none placeholder:text-[#646b60]'
                  />
                </div>

                <div>
                  <FieldLabel label={t(lang, 'ticker')} required count={ticker.length} max={12} />
                  <div className='flex h-12 items-center rounded-[18px] border border-white/8 bg-[#111410] px-4 text-sm text-[#f3f1e8]'>
                    <span className='mr-2 text-[#737a6d]'>$</span>
                    <input
                      id='ticker'
                      value={ticker}
                      maxLength={12}
                      onChange={(event) => setTicker(event.target.value.toUpperCase())}
                      placeholder={locale.tickerPlaceholder}
                      className='w-full bg-transparent outline-none placeholder:text-[#646b60]'
                    />
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel label={locale.tokenStoryLabel} count={story.length} max={STORY_MAX} />
                <textarea
                  id='story'
                  value={story}
                  maxLength={STORY_MAX}
                  onChange={(event) => setStory(event.target.value)}
                  placeholder={locale.storyPlaceholder}
                  className='min-h-[160px] w-full rounded-[20px] border border-white/8 bg-[#111410] px-4 py-3.5 text-sm leading-7 text-[#f3f1e8] outline-none placeholder:text-[#646b60]'
                />
              </div>

              <div className='rounded-[24px] border border-white/8 bg-[#111410] p-4 sm:p-5'>
                <div className='mb-5 flex items-center gap-2 text-sm font-medium text-[#f3f1e8]'>
                  <Link2 className='h-4 w-4 text-[#f1e4b7]' />
                  {locale.socialLinks}
                </div>
                <div className='grid gap-4 lg:grid-cols-3'>
                  <div>
                    <FieldLabel label={locale.websiteLabel} count={websiteUrl.length} max={URL_MAX} />
                    <div className='relative'>
                      <Globe className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f766a]' />
                      <input
                        value={websiteUrl}
                        maxLength={URL_MAX}
                        onChange={(event) => setWebsiteUrl(event.target.value)}
                        placeholder={locale.websitePlaceholder}
                        className='h-12 w-full rounded-[16px] border border-white/8 bg-[#171b17] pl-10 pr-3 text-sm text-[#f3f1e8] outline-none placeholder:text-[#646b60]'
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel label={locale.xLabel} count={twitterUrl.length} max={URL_MAX} />
                    <div className='relative'>
                      <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6f766a]'>X</span>
                      <input
                        value={twitterUrl}
                        maxLength={URL_MAX}
                        onChange={(event) => setTwitterUrl(event.target.value)}
                        placeholder={locale.xPlaceholder}
                        className='h-12 w-full rounded-[16px] border border-white/8 bg-[#171b17] pl-10 pr-3 text-sm text-[#f3f1e8] outline-none placeholder:text-[#646b60]'
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel label={locale.telegramLabel} count={telegramUrl.length} max={URL_MAX} />
                    <div className='relative'>
                      <MessageCircle className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f766a]' />
                      <input
                        value={telegramUrl}
                        maxLength={URL_MAX}
                        onChange={(event) => setTelegramUrl(event.target.value)}
                        placeholder={locale.telegramPlaceholder}
                        className='h-12 w-full rounded-[16px] border border-white/8 bg-[#171b17] pl-10 pr-3 text-sm text-[#f3f1e8] outline-none placeholder:text-[#646b60]'
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id='pair' className='rounded-[30px] border border-white/8 bg-[#171a17] p-5 sm:p-7'>
            <SectionHeading step='02' title={t(lang, 'findPerfectPair')} description={t(lang, 'chooseWhatTrades')} />

            <div className='space-y-7'>
              <div className='grid gap-5 lg:grid-cols-2'>
                <div>
                  <FieldLabel label={locale.poolMode} required />
                  <div className='grid gap-3 sm:grid-cols-2'>
                    {[
                      ['single', locale.singlePool],
                      ['multi', locale.multiPool],
                    ].map(([value, label]) => {
                      const active = poolMode === value;
                      return (
                        <button
                          key={value}
                          type='button'
                          onClick={() => setPoolMode(value as 'single' | 'multi')}
                          className={`rounded-[18px] border px-4 py-4 text-left transition ${
                            active ? 'border-[#f1e4b744] bg-[#1d211d] text-[#f3f1e8]' : 'border-white/8 bg-[#111410] text-[#a2a89d]'
                          }`}
                        >
                          <div className='text-sm font-medium'>{label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <FieldLabel label={locale.pairAsset} required />
                  <div className='relative'>
                    <select
                      value={pair}
                      onChange={(event) => setPair(event.target.value as (typeof pairOptions)[number]['key'])}
                      className='h-12 w-full appearance-none rounded-[18px] border border-white/8 bg-[#111410] px-4 pr-10 text-sm text-[#f3f1e8] outline-none'
                    >
                      {localizedPairOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}{option.subtitle ? ` · ${option.subtitle}` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f766a]' />
                  </div>
                </div>
              </div>

              {pair === 'ANY' ? (
                <div>
                  <FieldLabel label={locale.quoteTokenPlaceholder.replaceAll('BSC', chain.shortName)} count={quoteTokenInput.length} max={ADDRESS_MAX} />
                  <input
                    value={quoteTokenInput}
                    maxLength={ADDRESS_MAX}
                    onChange={(event) => setQuoteTokenInput(event.target.value)}
                    placeholder={locale.quoteTokenPlaceholder.replaceAll('BSC', chain.shortName)}
                    className='h-12 w-full rounded-[18px] border border-white/8 bg-[#111410] px-4 text-sm text-[#f3f1e8] outline-none placeholder:text-[#646b60]'
                  />
                  <div className='mt-3 text-xs text-[#8f9482]'>
                    {resolvedCustomQuoteToken ? (
                      customQuoteSymbol || customQuoteName ? (
                        <span>
                          {locale.quoteTokenDetected}: <span className='text-[#f3f1e8]'>{customQuoteName ?? customQuoteSymbol}</span>
                          {customQuoteSymbol ? <span className='text-[#d8c483]'> ({customQuoteSymbol})</span> : null}
                        </span>
                      ) : (
                        <span>{t(lang, 'search')}...</span>
                      )
                    ) : quoteTokenInput.trim() ? (
                      <span className='text-[#f87171]'>
                        {locale.quoteTokenInvalid.replaceAll('BSC', chain.shortName).replace('BEP20', 'ERC20')}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className='rounded-[24px] border border-white/8 bg-[#111410] p-5'>
                <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                  <div className='space-y-5'>
                    <div>
                      <FieldLabel label={locale.networkHintLabel} required />
                      <div className='rounded-[18px] border border-white/8 bg-[#171b17] px-4 py-3 text-sm text-[#f3f1e8]'>
                        {chainMainnetLabel}
                      </div>
                    </div>

                    <div>
                      <FieldLabel label={locale.creatorFees} />
                      <div className='grid gap-3 sm:grid-cols-2'>
                        <button
                          type='button'
                          onClick={() => setFeeTarget('wallet')}
                          className={`rounded-[18px] border px-4 py-4 text-left transition ${
                            feeTarget === 'wallet' ? 'border-[#f1e4b744] bg-[#1d211d] text-[#f3f1e8]' : 'border-white/8 bg-[#171b17] text-[#a2a89d]'
                          }`}
                        >
                          <div className='text-sm font-medium'>{t(lang, 'feeWallet')}</div>
                          <div className='mt-1 text-xs text-[#767d71]'>{locale.feeTargetHint}</div>
                        </button>
                        <button
                          type='button'
                          onClick={() => setFeeTarget('holders')}
                          className={`rounded-[18px] border px-4 py-4 text-left transition ${
                            feeTarget === 'holders' ? 'border-[#f1e4b744] bg-[#1d211d] text-[#f3f1e8]' : 'border-white/8 bg-[#171b17] text-[#a2a89d]'
                          }`}
                        >
                          <div className='text-sm font-medium'>{locale.holders}</div>
                          <div className='mt-1 text-xs text-[#767d71]'>{locale.feeTargetHint}</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className='space-y-5'>
                    <div>
                      <FieldLabel label={locale.creatorFeeWallet} count={feeWallet.length} max={ADDRESS_MAX} />
                      <input
                        value={feeWallet}
                        maxLength={ADDRESS_MAX}
                        onChange={(event) => setFeeWallet(event.target.value)}
                        placeholder={locale.feeRecipientPlaceholder}
                        className='h-12 w-full rounded-[18px] border border-white/8 bg-[#171b17] px-4 text-sm text-[#f3f1e8] outline-none placeholder:text-[#646b60]'
                      />
                    </div>

                    <div>
                      <FieldLabel label={locale.firstBuyOptional} />
                      <div className='flex h-12 w-full items-center rounded-[18px] border border-white/8 bg-[#171b17] px-4 text-sm text-[#f3f1e8]'>
                        <input
                          value={firstBuy}
                          onChange={(event) => setFirstBuy(event.target.value)}
                          className='w-full bg-transparent outline-none'
                        />
                        <span className='ml-3 text-[#6f766a]'>{pairLabel}</span>
                      </div>
                      <p className='mt-2 text-xs text-[#737a6d]'>{locale.firstBuyOptionalHint}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='rounded-[30px] border border-white/8 bg-[#171a17] p-5 sm:p-7'>
            <SectionHeading step='03' title={t(lang, 'reviewAndCreate')} description={locale.reviewSummaryHint} />

            <div className='space-y-6'>
              <div className='rounded-[24px] border border-white/8 bg-[#111410] p-5'>
                <div className='mb-4 text-sm font-medium text-[#f3f1e8]'>{locale.reviewSummary}</div>
                <div className='grid gap-3 rounded-[20px] border border-white/8 bg-[#171b17] p-4 text-sm'>
                  {reviewRows.map((row) => (
                    <div key={row.label} className='flex items-center justify-between gap-4'>
                      <span className='text-[#737a6d]'>{row.label}</span>
                      <span className='max-w-[65%] text-right text-[#f3f1e8]'>{row.value}</span>
                    </div>
                  ))}
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-[#737a6d]'>{t(lang, 'firstPurchase')}</span>
                    <span className='text-[#f3f1e8]'>{firstBuy || '0.00'} {pairLabel}</span>
                  </div>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-[#737a6d]'>{locale.socialLinks}</span>
                    <span className='max-w-[65%] text-right text-[#f3f1e8]'>{socialReadyText}</span>
                  </div>
                </div>
                <p className='mt-4 text-sm leading-7 text-[#8e9488]'>
                  {locale.reviewSummaryHint}
                </p>
              </div>

              <LaunchSubmitActions
                lang={lang}
                chainKey={chainKey}
                name={name}
                ticker={ticker}
                story={story}
                websiteUrl={websiteUrl}
                twitterUrl={twitterUrl}
                telegramUrl={telegramUrl}
                imageUrl={imageUrl}
                imageUploading={imageUploading}
                pair={pair}
                feeTarget={feeTarget}
                firstBuy={firstBuy}
                feeWallet={feeWallet}
                quoteTokenInput={quoteTokenInput}
                totalSupply={totalSupply}
                feeTier={feeTier}
                initialBuyMinTokensOut={initialBuyMinTokensOut}
              />
            </div>
          </div>
        </section>

        <aside className='min-w-0 xl:sticky xl:top-24 xl:self-start'>
          <div className='rounded-[30px] border border-white/8 bg-[#171a17] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.22)] sm:p-6'>
            <div className='mb-5 flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-medium uppercase tracking-[0.18em] text-[#7f8779]'>{locale.livePreviewPanel}</p>
                <p className='mt-2 text-sm leading-7 text-[#8e9488]'>{locale.realtimePreview}</p>
              </div>
              <span className='rounded-full border border-white/8 bg-[#111410] px-3 py-1 text-xs text-[#f1e4b7]'>
                {t(lang, 'preLaunch')}
              </span>
            </div>

            <div className='rounded-[26px] border border-white/8 bg-[#10130f] p-5 sm:p-6'>
              <div className='rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_bottom,rgba(101,92,255,0.24),rgba(16,19,15,0)_45%),#131712] p-5'>
                <div className='flex items-start gap-4'>
                  {imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreviewUrl} alt='Token preview' className='h-20 w-20 rounded-[22px] border border-white/10 object-cover' />
                  ) : (
                    <div className='flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/10 bg-[#191d19] text-[#f1e4b7]'>
                      <ImagePlus className='h-7 w-7' />
                    </div>
                  )}
                  <div className='min-w-0 flex-1'>
                    <div className='text-xs uppercase tracking-[0.18em] text-[#737a6d]'>{locale.previewCardHint}</div>
                    <h3 className='mt-3 truncate text-[1.6rem] font-semibold tracking-[-0.06em] text-[#f3f1e8]'>
                      {name || locale.yourTokenName}
                    </h3>
                    <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-[#c2c8bd]'>
                      <span>${ticker || 'TICKER'}</span>
                      <span className='text-[#5f665b]'>/</span>
                      <span>{pairLabel}</span>
                    </div>
                  </div>
                </div>

                <p className='mt-5 min-h-[84px] text-sm leading-7 text-[#8e9488]'>
                  {story || locale.previewStory}
                </p>

                <div className='mt-5 grid gap-3 rounded-[20px] border border-white/8 bg-[#0d0f0d] p-4 text-sm'>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-[#737a6d]'>{locale.previewPair}</span>
                    <span className='text-[#f3f1e8]'>${ticker || 'TICKER'} / {pairLabel}</span>
                  </div>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-[#737a6d]'>{locale.previewChain}</span>
                    <span className='text-[#f3f1e8]'>{chain.name}</span>
                  </div>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-[#737a6d]'>{locale.previewStatus}</span>
                    <span className='text-[#f3f1e8]'>{t(lang, 'preLaunch')}</span>
                  </div>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-[#737a6d]'>{locale.previewPoolMode}</span>
                    <span className='text-[#f3f1e8]'>{poolMode === 'single' ? locale.singlePool : locale.multiPool}</span>
                  </div>
                </div>

                <div className='mt-5 flex flex-wrap gap-2 text-xs'>
                  {websiteUrl ? <span className='rounded-full border border-white/8 bg-[#111410] px-3 py-1.5 text-[#f1e4b7]'>{locale.websiteLabel}</span> : null}
                  {twitterUrl ? <span className='rounded-full border border-white/8 bg-[#111410] px-3 py-1.5 text-[#f1e4b7]'>{locale.xLabel}</span> : null}
                  {telegramUrl ? <span className='rounded-full border border-white/8 bg-[#111410] px-3 py-1.5 text-[#f1e4b7]'>{locale.telegramLabel}</span> : null}
                  {!websiteUrl && !twitterUrl && !telegramUrl ? (
                    <span className='rounded-full border border-white/8 bg-[#111410] px-3 py-1.5 text-[#737a6d]'>{locale.noLinksYet}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
