import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { MarketHeader } from '@/components/market-header';
import { getMarketOverview } from '@/lib/api';
import { normalizeChainKey, withLangAndChain, type ChainKey } from '@/lib/chains';
import { normalizeLang, t, withLang, type Lang } from '@/lib/i18n';

function getDocsContent(lang: Lang, chainKey: ChainKey) {
  const isBsc = chainKey === 'bsc';
  const isBase = chainKey === 'base';
  const chainNameEn = isBsc ? 'BNB Smart Chain' : isBase ? 'Base' : 'Robinhood';
  const chainNameZh = isBsc ? 'BNB Smart Chain' : isBase ? 'Base' : 'Robinhood';
  const chainNameJa = isBsc ? 'BNB Smart Chain' : isBase ? 'Base' : 'Robinhood';
  const chainId = isBsc ? '56' : isBase ? '8453' : '4663';
  const launchVenueEn = isBsc || isBase ? 'PancakeSwap V3' : 'Uni v3';
  const launchVenueZh = isBsc || isBase ? 'PancakeSwap V3' : 'Uni v3';
  const launchVenueJa = isBsc || isBase ? 'PancakeSwap V3' : 'Uni v3';
  const nativeSymbol = isBsc ? 'BNB' : 'ETH';
  const wrappedNativeName = isBsc ? 'Wrapped BNB' : 'WETH';
  const stableSymbol = isBsc ? 'USDT' : isBase ? 'USDC' : 'USDG';
  const explorerName = isBsc ? 'BscScan' : isBase ? 'Basescan' : 'Blockscout';
  const anyTokenLabelEn = isBsc ? 'Any BSC token' : isBase ? 'Any Base token' : 'Any Robinhood token';
  const anyTokenLabelZh = anyTokenLabelEn;
  const anyTokenLabelJa = anyTokenLabelEn;
  const contracts =
    chainKey === 'robinhood'
      ? ([
          ['EagleFactory', '0x3A4CE33bb65b9429465b6EAda2F29C9f7bF0a122'],
          ['EagleLiquidityLocker', '0x7DF4EE3EF16856cc2A834860558ac72Dea997641'],
          ['EagleDistributorFactory', '0x834BEB67eA63d4246BD6B7D1928b2EBD57838F8c'],
          ['Uni V3 Factory', '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA'],
          ['Position Manager', '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3'],
          ['Wrapped ETH', '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'],
          ['USDG', '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'],
        ] as const)
      : chainKey === 'base'
        ? ([
            ['EagleFactory', '0xEfca26BAc433975a27E894eeD196C8a1D32c4beE'],
            ['EagleLiquidityLocker', '0x01ec131cF83F2978780D969b79f4839090618187'],
            ['EagleDistributorFactory', '0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726'],
            ['PancakeSwap V3 Factory', '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'],
            ['Position Manager', '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364'],
            ['Smart Router', '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86'],
            ['Quoter V2', '0x3d146FcE6c1006857750cBe8aF44f76a28041CCc'],
            ['Wrapped ETH', '0x4200000000000000000000000000000000000006'],
            ['USDC', '0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913'],
          ] as const)
        : ([
            ['EagleFactory', '0xEfca26BAc433975a27E894eeD196C8a1D32c4beE'],
            ['EagleLiquidityLocker', '0x01ec131cF83F2978780D969b79f4839090618187'],
            ['EagleDistributorFactory', '0x5BD10Eb12669EfCA5c8BF1Bb3d66287783E97726'],
            ['PancakeSwap V3 Factory', '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'],
            ['Position Manager', '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364'],
            ['Smart Router', '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4'],
            ['Quoter V2', '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997'],
            ['Wrapped BNB', '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'],
            ['USDT', '0x55d398326f99059fF775485246999027B3197955'],
          ] as const);

  if (lang === 'zh') {
    return {
      heroEyebrow: `${chainNameZh} · Mainnet`,
      navItems: [
        ['#getting-started', '创建代币'],
        ['#pairing', '选择交易对'],
        ['#trading', '探索与交易'],
        ['#fees', '费用与奖励'],
        ['#contracts', '合约地址'],
        ['#questions', '常见问题'],
      ] as const,
      sections: [
        {
          id: 'getting-started',
          index: '01',
          title: '创建代币',
          body: `Eagle 会把你的代币直接发射到 ${chainNameZh} 上的 ${launchVenueZh} 池子。创建确认并完成索引后，代币会出现在 Explore，并拥有自己的详情页。`,
          steps: [
            '做出你的风格：添加名称、Ticker 和图片。Ticker 会保留你的大小写。再补充描述和社区链接，方便大家找到你。',
            `选择交易资产：可选 ${nativeSymbol}、${stableSymbol} 或其他兼容的 ${chainNameZh} 代币，它会成为你的配对资产。`,
            '设置发射参数：选择创作者费用去向，也可以用配对资产添加一笔可选首购。',
            `连接并发射：连接钱包，切到 ${chainNameZh}，确认发射信息，并预留足够 ${nativeSymbol} 作为链上手续费。`,
          ],
          notes: ['初始供应量：1,000,000,000 枚 · 18 位小数', '池子交易费：1%', '发射流动性：永久锁定在 Eagle locker'],
        },
        {
          id: 'pairing',
          index: '02',
          title: '选择交易对',
          body: `交易对是你的代币用来交易的另一种资产。你可以从热门 ${chainNameZh} 代币里选择、按名称或 Ticker 搜索，或者在 ${anyTokenLabelZh} 中直接粘贴完整合约地址。`,
          steps: [
            `${nativeSymbol}：使用 ${chainNameZh} 原生币，池子内部会采用 ${wrappedNativeName}。`,
            `${stableSymbol}：${stableSymbol} 选项对应当前 ${chainNameZh} 默认稳定币。`,
            `社区代币：也可以与兼容的 meme 币、普通代币或 ${chainNameZh} 上发行的资产配对。`,
          ],
        },
        {
          id: 'trading',
          index: '03',
          title: '探索与交易',
          body: `从 Explore 打开任意代币，可以看到图表、最新成交、持有人和右侧 swap 面板。每条活动记录都可以跳转到 ${explorerName}。`,
          steps: [`可以用配对资产或 ${nativeSymbol} 买入。`, '报价会跟随交易刷新，开始交易和授权之后 Eagle 都会重新获取最新报价。'],
        },
        {
          id: 'fees',
          index: '04',
          title: '费用与奖励',
          body: '通过 Eagle 发射池进行的交易会收取 1% 池子费用。配对资产侧的费用会在创作者费用接收地址和协议之间分配。',
          steps: ['领取创作者费用：在代币页面连接费用接收钱包，然后选择 Claim fees。', '将费用分配给持有人：分发会用这些费用买入已发射代币，并发送到燃烧地址。'],
        },
        {
          id: 'contracts',
          index: '05',
          title: '合约地址',
          body: `以下是 Eagle 在 ${chainNameZh} 主网使用的合约地址，Chain ID ${chainId}。你可以复制地址或直接在 ${explorerName} 打开。`,
          contracts,
        },
        {
          id: 'questions',
          index: '06',
          title: '常见问题',
          body: '请使用已安装并启用钱包扩展的浏览器，或者钱包自带浏览器。先解锁钱包，再允许它连接到 Eagle。',
          steps: [
            '发射后还能改名称或 Ticker 吗？不能，确认前请检查清楚。',
            '为什么新交易没有 USD 价格？数据提供方在历史 USD 数据索引完成前可能会有延迟。',
            '创作者可以移除发射流动性吗？不能，发射头寸会永久保存在 EagleLiquidityLocker。',
          ],
        },
      ],
    };
  }

  if (lang === 'ja') {
    return {
      heroEyebrow: `${chainNameJa} · Mainnet`,
      navItems: [
        ['#getting-started', 'トークン作成'],
        ['#pairing', 'ペアを選ぶ'],
        ['#trading', '探索と取引'],
        ['#fees', '手数料と報酬'],
        ['#contracts', 'コントラクト'],
        ['#questions', 'よくある質問'],
      ] as const,
      sections: [
        {
          id: 'getting-started',
          index: '01',
          title: 'トークン作成',
          body: `Eagle はあなたのトークンを ${chainNameJa} 上の ${launchVenueJa} プールへ直接ローンチします。ローンチが確定してインデックスされると、トークンは Explore に表示され、専用ページを持ちます。`,
          steps: [
            'あなたらしく仕上げる: 名前、ティッカー、画像を追加します。ティッカーは選んだ大文字小文字を維持します。説明文やコミュニティリンクも追加できます。',
            `取引相手を選ぶ: ${nativeSymbol}、${stableSymbol}、または互換性のある ${chainNameJa} トークンを選択します。これがペア資産になります。`,
            'ローンチ設定を決める: クリエイター手数料の受け取り先を選び、必要ならペア資産で初回購入も追加できます。',
            `接続してローンチ: ウォレットを接続し、${chainNameJa} に切り替えて内容を確認します。ネットワーク手数料用に ${nativeSymbol} を残しておいてください。`,
          ],
          notes: ['初期供給量: 1,000,000,000 トークン · 18 decimals', 'ローンチプール手数料: 1%', 'ローンチ流動性: Eagle locker に永久ロック'],
        },
        {
          id: 'pairing',
          index: '02',
          title: 'ペアを選ぶ',
          body: `ペアはあなたのトークンが取引される相手資産です。人気の ${chainNameJa} トークンから選ぶか、名前やティッカーで検索するか、${anyTokenLabelJa} にコントラクトアドレスを貼り付けられます。`,
          steps: [
            `${nativeSymbol}: ${chainNameJa} のネイティブコインです。プール内部では ${wrappedNativeName} が使われます。`,
            `${stableSymbol}: ${chainNameJa} での既定の安定資産です。`,
            `コミュニティトークン: ${chainNameJa} 上の互換性あるミームコイン、通常のコイン、株式連動トークンとも組み合わせられます。`,
          ],
        },
        {
          id: 'trading',
          index: '03',
          title: '探索と取引',
          body: `Explore からトークンを開くと、チャート、最新取引、保有者、swap パネルを確認できます。各アクティビティ行から ${explorerName} を開けます。`,
          steps: [`ペア資産または ${nativeSymbol} で購入できます。`, '見積もりは取引に合わせて更新され、開始時と承認後に Eagle が再取得します。'],
        },
        {
          id: 'fees',
          index: '04',
          title: '手数料と報酬',
          body: 'Eagle のローンチプールを通る取引には 1% のプール手数料がかかります。ペア資産側の手数料は、クリエイター受取先とプロトコルに分配されます。',
          steps: ['クリエイター手数料を受け取る: トークンページで受取ウォレットを接続し、Claim fees を選択します。', '保有者へ分配する: 分配時にはその手数料でローンチ済みトークンを買い、バーンアドレスへ送ります。'],
        },
        {
          id: 'contracts',
          index: '05',
          title: 'コントラクト',
          body: `以下は Eagle が ${chainNameJa} mainnet で使用するコントラクトです。Chain ID は ${chainId}。アドレスをコピーするか、${explorerName} で開けます。`,
          contracts,
        },
        {
          id: 'questions',
          index: '06',
          title: 'よくある質問',
          body: 'ウォレット拡張が有効なブラウザ、またはウォレット内ブラウザを使用してください。ウォレットを解除し、Eagle への接続を許可します。',
          steps: [
            'ローンチ後に名前やティッカーを変更できますか？ できません。確認前によくチェックしてください。',
            '新しい取引に USD 価格がないのはなぜですか？ 履歴 USD データのインデックス完了までプロバイダーに遅延が生じることがあります。',
            'クリエイターはローンチ流動性を引き出せますか？ できません。ポジションは EagleLiquidityLocker に永久保存されます。',
          ],
        },
      ],
    };
  }

  return {
    heroEyebrow: `${chainNameEn} · Mainnet`,
    navItems: [
      ['#getting-started', 'Create your token'],
      ['#pairing', 'Choose your pair'],
      ['#trading', 'Explore & trade'],
      ['#fees', 'Fees & rewards'],
      ['#contracts', 'Contracts'],
      ['#questions', 'Common questions'],
    ] as const,
    sections: [
      {
        id: 'getting-started',
        index: '01',
        title: 'Create your token',
        body: `Eagle launches your token directly into a ${launchVenueEn} pool on ${chainNameEn}. Once the launch is confirmed and indexed, your token appears in Explore with its own page.`,
        steps: [
          'Make it yours: Add a name, ticker and artwork. Tickers keep your chosen capitalization. Add a description and community links so people can find you.',
          `Choose what it trades with: Select ${nativeSymbol}, ${stableSymbol} or another compatible ${chainNameEn} token. This becomes your token’s paired asset.`,
          'Set your launch preferences: Choose where creator fees go. You can also make an optional first purchase using the paired asset.',
          `Connect and launch: Connect your wallet, switch to ${chainNameEn} and confirm the launch details. Keep ${nativeSymbol} available for network fees.`,
        ],
        notes: [
          'Initial supply: 1,000,000,000 tokens · 18 decimals',
          'Launch pool fee: 1% on trades through this pool',
          'Launch liquidity: Locked permanently in Eagle’s locker',
        ],
      },
      {
        id: 'pairing',
        index: '02',
        title: 'Choose your pair',
        body: `Your pair is the asset your token trades against. Choose from trending ${chainNameEn} tokens, search by name or ticker, or paste the full contract address into ${anyTokenLabelEn}.`,
        steps: [
          `${nativeSymbol}: Use ${chainNameEn}'s native coin. Eagle uses ${wrappedNativeName} inside the pool.`,
          `${stableSymbol}: The ${stableSymbol} option uses the default stable asset configured for ${chainNameEn}.`,
          `Your community’s token: Pair with a compatible memecoin, coin or stock-linked token issued on ${chainNameEn}.`,
        ],
      },
      {
        id: 'trading',
        index: '03',
        title: 'Explore & trade',
        body: `Open a token from Explore to see its chart, recent trades, holders and swap panel. Each activity row opens the transaction on ${explorerName}.`,
        steps: [
          `Buy with the paired token or ${nativeSymbol}.`,
          'Your quote follows the trade. Eagle refreshes the quote when you begin the trade and again after approval.',
        ],
      },
      {
        id: 'fees',
        index: '04',
        title: 'Fees & rewards',
        body: 'Trades through an Eagle launch pool carry a 1% pool fee. Paired-token fees are split between the creator’s fee recipient and the protocol.',
        steps: [
          'Collect creator fees: Connect the fee-recipient wallet on your token page and choose Claim fees.',
          'Route fees to holders: A distribution uses those fees to buy the launched token and send it to the burn address.',
        ],
      },
      {
        id: 'contracts',
        index: '05',
        title: 'Contracts',
        body: `The contract addresses used by Eagle on ${chainNameEn} mainnet · Chain ID ${chainId}. Copy an address or open it on ${explorerName}.`,
        contracts,
      },
      {
        id: 'questions',
        index: '06',
        title: 'Common questions',
        body: 'Use a browser with your wallet extension installed and enabled, or your wallet’s own browser. Unlock the wallet and allow it to connect to Eagle.',
        steps: [
          'Can I change my name or ticker after launch? No, check them before confirming your launch.',
          'Why are new trades missing USD values? Providers can lag before historical USD price data finishes indexing.',
          'Can the creator remove the launch liquidity? No. The launch positions stay in EagleLiquidityLocker permanently.',
        ],
      },
    ],
  };
}

type DocsPageProps = {
  searchParams: Promise<{ lang?: string; chain?: string }>;
};

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const params = await searchParams;
  const lang = normalizeLang(params.lang);
  const chainKey = normalizeChainKey(params.chain);
  const overview = await getMarketOverview(chainKey);
  const { heroEyebrow, navItems, sections } = getDocsContent(lang, chainKey);

  return (
    <div className='min-h-screen bg-[#151714]'>
      <MarketHeader overview={overview} />
      <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-6'>
        <nav className='flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#d8c483]'>
          {navItems.map(([href, label]) => (
            <a key={href} href={href} className='transition hover:text-[#f1e4b7]'>
              {label}
            </a>
          ))}
        </nav>

        <section className='rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-5.5'>
          <p className='text-[13px] text-[#8f9482]'>{heroEyebrow}</p>
          <h1 className='mt-3 text-[2.6rem] font-semibold tracking-[-0.06em] text-[#f3f1e8]'>{t(lang, 'docsGuidance')}</h1>
          <h2 className='text-[2.2rem] font-semibold tracking-[-0.06em] text-[#f3f1e8]'>{t(lang, 'docsWholeNewToken')}</h2>
          <p className='mt-4 max-w-3xl text-[15px] leading-7 text-[#a8ad99]'>
            {t(lang, 'docsEverything')}
          </p>
          <a
            href='#contracts'
            className='mt-6 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-[#f1e4b7] transition hover:bg-white/[0.06]'
          >
            {t(lang, 'viewContractAddresses')}
            <ArrowUpRight className='h-3.5 w-3.5' />
          </a>
        </section>

        <section className='space-y-8'>
          {sections.map((section) => (
            <article key={section.id} id={section.id} className='rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-5.5'>
              <p className='text-[13px] text-[#8f9482]'>{section.index}</p>
              <h2 className='mt-3 text-[1.8rem] font-semibold tracking-[-0.05em] text-[#f3f1e8]'>{section.title}</h2>
              <p className='mt-4 max-w-4xl text-[14px] leading-7 text-[#a8ad99]'>{section.body}</p>

              {section.steps ? (
                <div className='mt-6 space-y-4'>
                  {section.steps.map((step, index) => (
                    <div key={step} className='grid gap-2 md:grid-cols-[44px_minmax(0,1fr)]'>
                      <div className='text-[13px] text-[#8f9482]'>{index + 1}</div>
                      <p className='text-[14px] leading-7 text-[#c7cbbe]'>{step}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {section.notes ? (
                <div className='mt-6 grid gap-3 md:grid-cols-3'>
                  {section.notes.map((note) => (
                    <div key={note} className='rounded-[18px] border border-white/8 bg-[#131512] p-4 text-[14px] text-[#c7cbbe]'>
                      {note}
                    </div>
                  ))}
                </div>
              ) : null}

              {section.contracts ? (
                <div className='mt-6 space-y-3'>
                  {section.contracts.map(([name, address]) => (
                    <div key={address} className='rounded-[18px] border border-white/8 bg-[#131512] p-4'>
                      <p className='text-[14px] font-medium text-[#f3f1e8]'>{name}</p>
                      <p className='mt-2 break-all text-[14px] text-[#a8ad99]'>{address}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>

        <section className='rounded-[28px] border border-white/8 bg-[#1a1c19]/96 p-5.5'>
          <p className='text-sm text-[#8f9482]'>{t(lang, 'yourIdeaIsNext')}</p>
          <Link
            href={withLangAndChain('/launch', lang, chainKey)}
            className='mt-4 inline-flex h-11 items-center rounded-full border border-[#f6e3ac66] bg-[linear-gradient(145deg,#f7e8ba,#d1b773)] px-5 text-sm font-medium text-[#342d1a] transition hover:brightness-105'
          >
            {t(lang, 'createAToken')}
          </Link>
        </section>
      </main>
    </div>
  );
}
