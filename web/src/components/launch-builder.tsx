'use client';

import Link from 'next/link';
import { Globe, ImagePlus, Plus, Search, Triangle } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { LaunchSubmitActions } from '@/components/launch-submit-actions';
import { t, withLang, type Lang } from '@/lib/i18n';

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
    totalSupplyHint: 'Eagle 默认使用 18 位精度，输入不带小数的总代币数量。',
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
    totalSupplyHint: 'Eagle uses 18 decimals by default. Enter the total token amount without decimals.',
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
    totalSupplyHint: 'Eagle は標準で 18 decimals を使います。小数なしの総数量を入力してください。',
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
  },
} as const;

export function LaunchBuilder({ lang }: { lang: Lang }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [story, setStory] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [pair, setPair] = useState<(typeof pairOptions)[number]['key']>('BNB');
  const [feeTarget, setFeeTarget] = useState<'wallet' | 'holders'>('wallet');
  const [firstBuy, setFirstBuy] = useState('0.00');
  const [feeWallet, setFeeWallet] = useState('');
  const [quoteTokenInput, setQuoteTokenInput] = useState('');
  const [totalSupply] = useState('1000000000');
  const [feeTier] = useState<100 | 500 | 2500 | 10000>(10000);
  const [initialBuyMinTokensOut] = useState('0');
  const advancedOpen = false;

  const pairLabel = useMemo(() => {
    if (pair === 'USDT') return 'USDT';
    if (pair === 'ANY') return 'TOKEN';
    return 'BNB';
  }, [pair]);

  const locale = copy[lang];
  const feeTargetLabel = feeTarget === 'wallet' ? t(lang, 'feeWallet') : locale.holders;
  const localizedPairOptions = pairOptions.map((option) => ({
    ...option,
    label: option.key === 'ANY' ? t(lang, 'anyBscToken') : option.label,
    subtitle: option.key === 'BNB' ? locale.native : option.key === 'USDT' ? locale.stable : option.subtitle,
  }));

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
      setImageError('仅支持 PNG、JPG、GIF、WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('图片不能超过 5 MB');
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
    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]'>
      <section className='space-y-5'>
        <div className='max-w-3xl text-center lg:text-left'>
          <p className='text-[11px] font-medium uppercase tracking-[0.24em] text-[#9da28f]'>{t(lang, 'madeForYourIdea')}</p>
          <h1 className='mt-3.5 text-[2.55rem] font-semibold tracking-[-0.065em] text-[#f3f1e8]'>{t(lang, 'littleIdea')}</h1>
          <h2 className='text-[2.2rem] font-semibold tracking-[-0.065em] text-[#f3f1e8]'>{t(lang, 'wholeNewToken')}</h2>
          <p className='mt-2.5 text-[15px] leading-7 text-[#a8ad99]'>
            {t(lang, 'makeItYoursLead')}
          </p>
          <Link
            href={withLang('/docs#getting-started', lang)}
            className='mt-5 inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-[#f1e4b7] transition hover:bg-white/[0.06]'
          >
            {t(lang, 'howItWorks')}
          </Link>
        </div>

        <div className='flex flex-wrap items-center gap-2.5 text-sm'>
          <a href='#story' className='rounded-full border border-[#e8d79f2f] bg-[#ffffff05] px-4 py-2.5 text-[#f1e4b7] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
            <span className='mr-2 font-semibold'>01</span>
            {t(lang, 'makeItYours')}
          </a>
          <a href='#pair' className='rounded-full border border-white/8 bg-[#131512] px-4 py-2.5 text-[#c5c9bc]'>
            <span className='mr-2 font-semibold'>02</span>
            {t(lang, 'setYourLaunch')}
          </a>
          <span className='px-1 py-2.5 text-[#8f9482]'>
            <span className='mr-2 font-semibold'>03</span>
            {t(lang, 'reviewAndCreate')}
          </span>
        </div>

        <div id='story' className='rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-5.5'>
          <div className='mb-5 flex items-start justify-between gap-4'>
            <div>
              <h3 className='text-[1.65rem] font-semibold tracking-[-0.05em] text-[#f3f1e8]'>{t(lang, 'startWithStory')}</h3>
              <p className='mt-2 text-sm leading-7 text-[#a8ad99]'>{t(lang, 'everyCommunityStarts')}</p>
            </div>
            <span className='text-sm text-[#8f9482]'>01</span>
          </div>

          <div className='space-y-5'>
            <div>
              <label className='mb-2 block text-sm font-medium text-[#f3f1e8]'>{t(lang, 'addTokenImage')}</label>
              <div className='rounded-[22px] border border-dashed border-white/12 bg-[#131512] p-5'>
                <div className='flex items-center gap-3'>
                  {imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreviewUrl}
                      alt='Token preview'
                      className='h-12 w-12 rounded-full border border-white/10 object-cover'
                    />
                  ) : (
                    <div className='flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#d8c483]'>
                      <ImagePlus className='h-5 w-5' />
                    </div>
                  )}
                  <div>
                    <p className='text-sm text-[#f3f1e8]'>{t(lang, 'dropItHere')}</p>
                    <p className='mt-1 text-xs text-[#8f9482]'>{locale.imageFormats}</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/png,image/jpeg,image/gif,image/webp'
                  onChange={handleImageChange}
                  className='hidden'
                />
                <div className='mt-4 flex flex-wrap items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => fileInputRef.current?.click()}
                    className='inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-[#f1e4b7] transition hover:bg-white/[0.06]'
                  >
                    {t(lang, 'chooseFile')}
                  </button>
                  <span className='text-xs text-[#8f9482]'>{imageFileName || t(lang, 'noFileChosen')}</span>
                  {imageUploading ? <span className='text-xs text-[#d8c483]'>上传中...</span> : null}
                </div>
                {imageError ? <p className='mt-3 text-xs text-[#f87171]'>{imageError}</p> : null}
              </div>
            </div>

            <div className='grid gap-5 md:grid-cols-[minmax(0,1fr)_200px]'>
              <div>
                <label htmlFor='token-name' className='mb-2 block text-sm font-medium text-[#f3f1e8]'>
                  {t(lang, 'tokenName')}
                </label>
                <input
                  id='token-name'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={locale.tokenNamePlaceholder}
                  className='h-12 w-full rounded-[18px] border border-white/8 bg-[#131512] px-4 text-sm text-[#f3f1e8] outline-none placeholder:text-[#6f7468]'
                />
              </div>
              <div>
                <label htmlFor='ticker' className='mb-2 block text-sm font-medium text-[#f3f1e8]'>
                  {t(lang, 'ticker')}
                </label>
                <div className='flex h-12 items-center rounded-[18px] border border-white/8 bg-[#131512] px-4 text-sm text-[#f3f1e8]'>
                  <span className='mr-2 text-[#8f9482]'>$</span>
                  <input
                    id='ticker'
                    value={ticker}
                    maxLength={12}
                    onChange={(event) => setTicker(event.target.value.toUpperCase())}
                    placeholder={locale.tickerPlaceholder}
                    className='w-full bg-transparent outline-none placeholder:text-[#6f7468]'
                  />
                  <span className='text-xs text-[#8f9482]'>{ticker.length}/12</span>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor='story' className='mb-2 block text-sm font-medium text-[#f3f1e8]'>
                {t(lang, 'yourStory')} <span className='text-[#8f9482]'>{t(lang, 'optional')}</span>
              </label>
              <textarea
                id='story'
                value={story}
                maxLength={1000}
                onChange={(event) => setStory(event.target.value)}
                placeholder={locale.storyPlaceholder}
                className='min-h-[128px] w-full rounded-[18px] border border-white/8 bg-[#131512] px-4 py-3 text-sm leading-7 text-[#f3f1e8] outline-none placeholder:text-[#6f7468]'
              />
              <p className='mt-2 text-right text-xs text-[#8f9482]'>{story.length} / 1,000</p>
            </div>

            <button
              type='button'
              className='inline-flex items-center gap-2 text-sm text-[#d8c483] transition hover:text-[#f1e4b7]'
            >
              <Plus className='h-4 w-4' />
              {t(lang, 'addWebsiteSocial')}
              <span className='text-[#8f9482]'>{t(lang, 'optional')}</span>
            </button>
          </div>
        </div>

        <div id='pair' className='rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-5.5'>
          <div className='mb-5 flex items-start justify-between gap-4'>
            <div>
              <h3 className='text-[1.65rem] font-semibold tracking-[-0.05em] text-[#f3f1e8]'>{t(lang, 'findPerfectPair')}</h3>
              <p className='mt-2 text-sm leading-7 text-[#a8ad99]'>{t(lang, 'chooseWhatTrades')}</p>
            </div>
            <span className='text-sm text-[#8f9482]'>02</span>
          </div>

          <div className='flex flex-wrap gap-3'>
            {localizedPairOptions.map((option) => {
              const active = option.key === pair;
              return (
                <button
                  key={option.key}
                  type='button'
                  onClick={() => setPair(option.key)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? 'border-[#e8d79f2f] bg-[#ffffff05] text-[#f1e4b7]'
                      : 'border-white/8 bg-[#131512] text-[#c5c9bc]'
                  }`}
                >
                  {option.icon ? <span className='mr-2'>{option.icon}</span> : null}
                  {option.label}
                  {option.subtitle ? <span className='ml-2 text-[#8f9482]'>{option.subtitle}</span> : null}
                </button>
              );
            })}
          </div>

          <div className='mt-4 flex h-12 items-center gap-3 rounded-[18px] border border-white/8 bg-[#131512] px-4 text-sm text-[#8f9482]'>
            <Search className='h-4 w-4' />
            {pair === 'ANY' ? (
              <input
                value={quoteTokenInput}
                onChange={(event) => setQuoteTokenInput(event.target.value)}
                placeholder='0x...'
                className='w-full bg-transparent text-sm text-[#f3f1e8] outline-none placeholder:text-[#6f7468]'
              />
            ) : (
              <span>{pair === 'BNB' ? 'WBNB' : 'USDT'}</span>
            )}
          </div>

          <div className='mt-6 space-y-5 rounded-[22px] border border-white/8 bg-[#131512] p-5'>
            <div className='flex items-center justify-between gap-4'>
              <span className='text-sm text-[#8f9482]'>{locale.tradingPair}</span>
              <span className='text-sm font-medium text-[#f3f1e8]'>${ticker || 'TICKER'} / {pairLabel}</span>
            </div>
            <div className='flex items-center justify-between gap-4'>
              <span className='text-sm text-[#8f9482]'>{t(lang, 'launchingOn')}</span>
              <span className='text-sm font-medium text-[#f3f1e8]'>{locale.chainMainnet}</span>
            </div>
            <div className='rounded-[18px] border border-white/8 bg-[#111310] p-4'>
              <p className='text-sm font-medium text-[#f3f1e8]'>{t(lang, 'launchFeelsLikeYou')}</p>
              <p className='mt-2 text-sm text-[#a8ad99]'>{t(lang, 'creatorFeesFirstBuyWallet')}</p>
              <p className='mt-1 text-xs text-[#8f9482]'>{t(lang, 'optional')}</p>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='rounded-[18px] border border-white/8 bg-[#111310] p-4'>
                <p className='text-sm text-[#8f9482]'>{locale.creatorFees}</p>
                <div className='mt-3 flex gap-2'>
                  <button
                    type='button'
                    onClick={() => setFeeTarget('wallet')}
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      feeTarget === 'wallet'
                        ? 'border border-[#e8d79f2f] bg-[#ffffff05] text-[#f1e4b7]'
                        : 'border border-white/8 bg-[#171916] text-[#a8ad99]'
                    }`}
                  >
                    {t(lang, 'feeWallet')}
                  </button>
                  <button
                    type='button'
                    onClick={() => setFeeTarget('holders')}
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      feeTarget === 'holders'
                        ? 'border border-[#e8d79f2f] bg-[#ffffff05] text-[#f1e4b7]'
                        : 'border border-white/8 bg-[#171916] text-[#a8ad99]'
                    }`}
                  >
                    {locale.holders}
                  </button>
                </div>
                <p className='mt-3 text-xs leading-6 text-[#8f9482]'>
                  {locale.feeTargetHint}
                </p>
              </div>

              <div className='rounded-[18px] border border-white/8 bg-[#111310] p-4'>
                <p className='text-sm text-[#8f9482]'>{t(lang, 'firstPurchase')}</p>
                <div className='mt-3 flex h-11 items-center rounded-[14px] border border-white/8 bg-[#171916] px-3 text-sm text-[#f3f1e8]'>
                  <input
                    value={firstBuy}
                    onChange={(event) => setFirstBuy(event.target.value)}
                    className='w-full bg-transparent outline-none'
                  />
                  <span className='text-[#8f9482]'>{pairLabel}</span>
                </div>
                <p className='mt-3 text-xs leading-6 text-[#8f9482]'>
                  {locale.firstPurchaseHint}
                </p>
              </div>
            </div>

            <div className='rounded-[18px] border border-white/8 bg-[#111310] p-4'>
              <div className='flex items-center justify-between gap-4'>
                <p className='text-sm text-[#8f9482]'>{t(lang, 'feeWallet')}</p>
                <span className='text-xs text-[#8f9482]'>{t(lang, 'optional')}</span>
              </div>
              <input
                value={feeWallet}
                onChange={(event) => setFeeWallet(event.target.value)}
                placeholder={locale.feeRecipientPlaceholder}
                className='mt-3 h-11 w-full rounded-[14px] border border-white/8 bg-[#171916] px-3 text-sm text-[#f3f1e8] outline-none placeholder:text-[#6f7468]'
              />
            </div>

            {null}
          </div>

          <div className='mt-5 space-y-4'>
            <div className='flex flex-wrap items-center gap-3'>
              <span className='text-sm font-medium text-[#f3f1e8]'>{t(lang, 'reviewYourToken')}</span>
              <span className='text-xs text-[#8f9482]'>{t(lang, 'saveDraft')}</span>
            </div>
            <div className='rounded-[18px] border border-white/8 bg-[#111310] p-4'>
              <p className='text-sm text-[#a8ad99]'>
                {t(lang, 'reviewYourToken')}
              </p>
              <div className='mt-3 grid gap-3 rounded-[14px] border border-white/8 bg-[#171916] p-3 text-sm'>
                <div className='flex items-center justify-between gap-4'>
                  <span className='text-[#8f9482]'>{locale.tradingPair}</span>
                  <span className='text-[#f3f1e8]'>${ticker || 'TICKER'} / {pairLabel}</span>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <span className='text-[#8f9482]'>{locale.creatorFees}</span>
                  <span className='text-[#f3f1e8]'>{feeTargetLabel}</span>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <span className='text-[#8f9482]'>{t(lang, 'firstPurchase')}</span>
                  <span className='text-[#f3f1e8]'>{firstBuy || '0.00'} {pairLabel}</span>
                </div>
                {advancedOpen ? (
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-[#8f9482]'>{locale.advancedSettings}</span>
                    <span className='text-[#f3f1e8]'>{locale.advancedSummary}</span>
                  </div>
                ) : null}
              </div>
              <p className='mt-3 text-sm leading-7 text-[#8f9482]'>
                {t(lang, 'launchesLiveOnBsc')}
              </p>
            </div>
            <LaunchSubmitActions
              lang={lang}
              name={name}
              ticker={ticker}
              story={story}
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

      <aside className='lg:sticky lg:top-20 lg:self-start'>
        <div className='rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.22)]'>
          <div className='mb-5 flex items-center justify-between'>
            <div>
              <p className='text-xs font-medium uppercase tracking-[0.18em] text-[#8f9482]'>{t(lang, 'livePreview')}</p>
              <p className='mt-1 text-sm text-[#a8ad99]'>{t(lang, 'yourIdeaComingToLife')}</p>
            </div>
            <span className='rounded-full border border-white/8 bg-[#131512] px-3 py-1 text-xs text-[#d8c483]'>◆ BNB CHAIN</span>
          </div>

          <div className='rounded-[24px] border border-white/8 bg-[#131512] p-5'>
            <p className='text-[11px] font-medium uppercase tracking-[0.18em] text-[#8f9482]'>{t(lang, 'yourNextBigThing')}</p>
            <h3 className='mt-3.5 text-[1.6rem] font-semibold tracking-[-0.05em] text-[#f3f1e8]'>
              {name || locale.yourTokenName}
            </h3>
            <p className='mt-1 text-[14px] text-[#c7cbbe]'>
              ${ticker || 'TICKER'} Paired with <span className='font-semibold text-[#f3f1e8]'>{pairLabel}</span>
            </p>
            <p className='mt-3.5 text-[14px] leading-7 text-[#a8ad99]'>
              {story || locale.previewStory}
            </p>

            <div className='mt-4 grid gap-3 rounded-[18px] border border-white/8 bg-[#10120f] p-4'>
              <div className='flex items-center justify-between text-[14px]'>
                <span className='text-[#8f9482]'>{t(lang, 'network')}</span>
                <span className='text-[#f3f1e8]'>{t(lang, 'bnbChain')}</span>
              </div>
              <div className='flex items-center justify-between text-[14px]'>
                <span className='text-[#8f9482]'>{t(lang, 'status')}</span>
                <span className='text-[#f3f1e8]'>{t(lang, 'preLaunch')}</span>
              </div>
              <div className='flex items-center justify-between text-[14px]'>
                <span className='text-[#8f9482]'>{t(lang, 'fees')}</span>
                <span className='text-[#f3f1e8]'>{feeTargetLabel}</span>
              </div>
              {advancedOpen ? (
                <div className='flex items-center justify-between text-[14px]'>
                  <span className='text-[#8f9482]'>{locale.advancedSettings}</span>
                  <span className='text-[#f3f1e8]'>{locale.advancedSummary}</span>
                </div>
              ) : null}
            </div>

            <p className='mt-4 text-[13px] text-[#8f9482]'>{t(lang, 'firstLook')}</p>
          </div>

          <div className='mt-5 rounded-[24px] border border-white/8 bg-[#131512] p-5'>
            <h4 className='text-[1.25rem] font-semibold tracking-[-0.04em] text-[#f3f1e8]'>{t(lang, 'bigCommunitiesStartSmall')}</h4>
            <p className='mt-3 text-sm leading-7 text-[#a8ad99]'>
              {t(lang, 'bringIdea')}
            </p>
            <p className='text-sm leading-7 text-[#a8ad99]'>{t(lang, 'makeSomething')}</p>

            <div className='mt-5 flex flex-wrap gap-2 text-sm'>
              <a href='https://www.bnbchain.org/' className='inline-flex h-10 items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-[#d8c483] transition hover:bg-white/[0.04]'>
                <Triangle className='h-3.5 w-3.5 fill-current stroke-none' />
              </a>
              <a href='https://www.bnbchain.org/' className='inline-flex h-10 items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-[#d8c483] transition hover:bg-white/[0.04]'>
                <Globe className='h-3.5 w-3.5' />
                {locale.builtForCreators}
              </a>
              <a href='https://www.bnbchain.org/' className='inline-flex h-10 items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-[#d8c483] transition hover:bg-white/[0.04]'>
                {locale.poweredByBnbChain}
              </a>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
