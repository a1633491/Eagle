const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

const DEBUG_SESSION_ID = 'robinhood-v4-first-buy';
const DEBUG_ENV_PATH = path.resolve(__dirname, '../../.dbg/robinhood-v4-first-buy.env');
const DEBUG_RUN_ID = process.env.DEBUG_RUN_ID || 'pre-fix';

function readDebugConfig() {
  let url = 'http://127.0.0.1:7777/event';
  let sessionId = DEBUG_SESSION_ID;
  try {
    const env = fs.readFileSync(DEBUG_ENV_PATH, 'utf8');
    for (const line of env.split('\n')) {
      if (line.startsWith('DEBUG_SERVER_URL=')) {
        url = line.slice('DEBUG_SERVER_URL='.length).trim();
      }
      if (line.startsWith('DEBUG_SESSION_ID=')) {
        sessionId = line.slice('DEBUG_SESSION_ID='.length).trim();
      }
    }
  } catch {}
  return { url, sessionId };
}

async function reportDebug(hypothesisId, location, msg, data) {
  const { url, sessionId } = readDebugConfig();
  if (typeof fetch !== 'function') {
    return;
  }
  try {
    const normalizedData = normalize(data);
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        runId: DEBUG_RUN_ID,
        hypothesisId,
        location,
        msg,
        data: normalizedData,
        ts: Date.now(),
      }),
    });
  } catch {}
}

function normalize(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

function summarizeError(error) {
  return normalize({
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: error?.message ?? null,
    shortMessage: error?.shortMessage ?? null,
    reason: error?.reason ?? null,
    data: error?.data ?? error?.info?.error?.data ?? null,
  });
}

function findFirstCall(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  if (!Array.isArray(node.calls)) return null;
  for (const child of node.calls) {
    const match = findFirstCall(child, predicate);
    if (match) return match;
  }
  return null;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function requiredAddress(name) {
  const value = requiredEnv(name);
  if (!hre.ethers.isAddress(value)) {
    throw new Error(`Invalid address in ${name}: ${value}`);
  }
  return value;
}

function requiredNumber(name) {
  const value = Number(requiredEnv(name));
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer in ${name}: ${value}`);
  }
  return value;
}

function requiredBigInt(name) {
  const value = requiredEnv(name);
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid bigint in ${name}: ${value}`);
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer account available');
  }
  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();

  const poolManager = requiredAddress('UNISWAP_V4_POOL_MANAGER');
  const positionManager = requiredAddress('UNISWAP_V4_POSITION_MANAGER');
  const wrappedNative = requiredAddress('WETH');
  const universalRouter = requiredAddress('UNISWAP_UNIVERSAL_ROUTER');
  const owner = requiredAddress('FACTORY_OWNER');
  const treasury = requiredAddress('FACTORY_TREASURY');
  const protocolLpFeeBps = requiredNumber('PROTOCOL_LP_FEE_BPS');
  const smokeLaunchFeeWei =
    process.env.SMOKE_LAUNCH_FEE_WEI !== undefined ? BigInt(process.env.SMOKE_LAUNCH_FEE_WEI) : 0n;
  const quoteToken = process.env.SMOKE_QUOTE_TOKEN || wrappedNative;
  const fee = process.env.SMOKE_POOL_FEE ? Number(process.env.SMOKE_POOL_FEE) : 10_000;
  const tickSpacing = process.env.SMOKE_TICK_SPACING ? Number(process.env.SMOKE_TICK_SPACING) : 200;
  const initialTick = process.env.SMOKE_INITIAL_TICK ? Number(process.env.SMOKE_INITIAL_TICK) : 0;
  const totalSupply =
    process.env.SMOKE_TOTAL_SUPPLY !== undefined ? requiredBigInt('SMOKE_TOTAL_SUPPLY') : 1_000_000_000n * 10n ** 18n;
  const maxLaunchFeeWei =
    process.env.SMOKE_MAX_LAUNCH_FEE_WEI !== undefined ? requiredBigInt('SMOKE_MAX_LAUNCH_FEE_WEI') : smokeLaunchFeeWei;
  const initialBuyQuoteAmount =
    process.env.SMOKE_INITIAL_BUY_QUOTE_AMOUNT !== undefined ? requiredBigInt('SMOKE_INITIAL_BUY_QUOTE_AMOUNT') : 0n;
  const initialBuyMinTokensOut =
    process.env.SMOKE_INITIAL_BUY_MIN_TOKENS_OUT !== undefined ? requiredBigInt('SMOKE_INITIAL_BUY_MIN_TOKENS_OUT') : 0n;
  const saltSource = process.env.SMOKE_SALT || `${Date.now()}`;
  const salt = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(saltSource));

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Smoke launch fee: ${smokeLaunchFeeWei.toString()}`);

  // #region debug-point E:router-build
  const universalRouterCode = await provider.getCode(universalRouter);
  await reportDebug('E', 'contracts-recovered/scripts/smoke-robinhood-v4-launch.js:router-build', '[DEBUG] Loaded Robinhood smoke launch config', {
    chainId: network.chainId,
    networkName: hre.network.name,
    deployer: deployer.address,
    universalRouter,
    universalRouterCodeHash: universalRouterCode === '0x' ? null : hre.ethers.keccak256(universalRouterCode),
    universalRouterCodeSize: universalRouterCode === '0x' ? 0 : (universalRouterCode.length - 2) / 2,
    poolManager,
    positionManager,
    wrappedNative,
    quoteToken,
    initialBuyQuoteAmount,
    initialBuyMinTokensOut,
  });
  // #endregion

  const factoryFactory = await hre.ethers.getContractFactory(
    'contracts/RobinhoodUniV4LaunchSuite.sol:ZeroFactory',
  );
  const factory = await factoryFactory.deploy(
    poolManager,
    positionManager,
    wrappedNative,
    universalRouter,
    owner,
    treasury,
    smokeLaunchFeeWei,
    protocolLpFeeBps,
  );
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const lockerAddress = await factory.locker();
  console.log(`Smoke factory deployed: ${factoryAddress}`);
  console.log(`Smoke locker deployed: ${lockerAddress}`);

  const params = {
    name: `Smoke Robinhood ${Date.now()}`,
    symbol: 'SRH',
    metadataURI: 'data:application/json,%7B%22name%22%3A%22Smoke%20Robinhood%22%2C%22symbol%22%3A%22SRH%22%7D',
    totalSupply,
    quoteToken,
    fee,
    tickSpacing,
    initialTick,
    hooks: hre.ethers.ZeroAddress,
    positions: [],
    creatorFeeRecipient: deployer.address,
    initialBuyQuoteAmount,
    initialBuyMinTokensOut,
    initialBuyRecipient: hre.ethers.ZeroAddress,
    salt,
    maxLaunchFeeWei,
  };

  const txValue = smokeLaunchFeeWei + (quoteToken.toLowerCase() === wrappedNative.toLowerCase() ? initialBuyQuoteAmount : 0n);
  const populatedLaunchTx = await factory.launch.populateTransaction(params, { value: txValue });
  // #region debug-point A:launch-input
  await reportDebug('A', 'contracts-recovered/scripts/smoke-robinhood-v4-launch.js:launch-input', '[DEBUG] Prepared launch transaction', {
    factoryAddress,
    lockerAddress,
    txValue,
    launchCalldataBytes: populatedLaunchTx.data ? (populatedLaunchTx.data.length - 2) / 2 : 0,
    launchSelector: populatedLaunchTx.data ? populatedLaunchTx.data.slice(0, 10) : null,
    params,
  });
  // #endregion

  try {
    const trace = await provider.send('debug_traceCall', [
      {
        from: deployer.address,
        to: factoryAddress,
        data: populatedLaunchTx.data,
        value: `0x${txValue.toString(16)}`,
      },
      'latest',
      { tracer: 'callTracer' },
    ]);
    const routerCall = findFirstCall(
      trace,
      (call) => typeof call?.to === 'string' && call.to.toLowerCase() === universalRouter.toLowerCase(),
    );
    const poolManagerCall = findFirstCall(
      trace,
      (call) => typeof call?.to === 'string' && call.to.toLowerCase() === poolManager.toLowerCase(),
    );
    let decodedRouter = null;
    if (routerCall?.input) {
      const routerInterface = new hre.ethers.Interface(['function execute(bytes commands, bytes[] inputs, uint256 deadline)']);
      const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
      const [commands, inputs, deadline] = routerInterface.decodeFunctionData('execute', routerCall.input);
      const [actions, actionParams] = abiCoder.decode(['bytes', 'bytes[]'], inputs[0]);
      const [swapParams] = abiCoder.decode(
        ['tuple(tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)'],
        actionParams[0],
      );
      const [settleCurrency, settleAmount] = abiCoder.decode(['address', 'uint256'], actionParams[1]);
      const [takeCurrency, takeAmount] = abiCoder.decode(['address', 'uint256'], actionParams[2]);
      decodedRouter = normalize({
        commands,
        deadline,
        actions,
        actionParamsLength: actionParams.length,
        swapParams,
        settleCurrency,
        settleAmount,
        takeCurrency,
        takeAmount,
      });
    }
    // #region debug-point C:router-trace
    await reportDebug('C', 'contracts-recovered/scripts/smoke-robinhood-v4-launch.js:router-trace', '[DEBUG] Captured pre-fix launch trace', {
      topLevelError: trace?.error ?? null,
      routerError: routerCall?.error ?? null,
      routerRevertReason: routerCall?.revertReason ?? null,
      routerInputBytes: routerCall?.input ? (routerCall.input.length - 2) / 2 : 0,
      poolManagerError: poolManagerCall?.error ?? null,
      poolManagerInputSelector: poolManagerCall?.input?.slice(0, 10) ?? null,
      decodedRouter,
    });
    // #endregion
  } catch (traceError) {
    // #region debug-point C:router-trace-failed
    await reportDebug('C', 'contracts-recovered/scripts/smoke-robinhood-v4-launch.js:router-trace-failed', '[DEBUG] Failed to capture pre-fix launch trace', summarizeError(traceError));
    // #endregion
  }

  let gasEstimate;
  try {
    gasEstimate = await factory.launch.estimateGas(params, { value: txValue });
  } catch (estimateError) {
    // #region debug-point D:estimate-gas-failed
    await reportDebug('D', 'contracts-recovered/scripts/smoke-robinhood-v4-launch.js:estimate-gas-failed', '[DEBUG] Launch gas estimate reverted', summarizeError(estimateError));
    // #endregion
    throw estimateError;
  }
  console.log(`Estimated launch gas: ${gasEstimate.toString()}`);

  const tx = await factory.launch(params, { value: txValue });
  const receipt = await tx.wait();
  console.log(`Launch tx hash: ${receipt.hash}`);

  const launchEvent = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log) => log && log.name === 'TokenLaunched');

  if (!launchEvent) {
    throw new Error('TokenLaunched event not found in receipt');
  }

  const tokenAddress = launchEvent.args.token;
  const positions = await factory.totalLaunches();
  const locker = await hre.ethers.getContractAt(
    'contracts/RobinhoodUniV4LaunchSuite.sol:ZeroLiquidityLocker',
    lockerAddress,
  );
  const lockedIds = await locker.positionsOf(tokenAddress);

  console.log(
    JSON.stringify(
      {
        factoryAddress,
        lockerAddress,
        tokenAddress,
        totalLaunches: positions.toString(),
        lockedPositionIds: lockedIds.map((id) => id.toString()),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
