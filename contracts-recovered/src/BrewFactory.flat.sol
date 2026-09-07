// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

    IPancakeV3Factory,
    IPancakeV3Pool,
    IPancakeV3SwapCallback,
    INonfungiblePositionManager,
    IWBNB
} from "./interfaces/IPancakeV3.sol";

/// @title BrewFactory
/// @notice Launches creator tokens straight onto PancakeSwap V3 with one-sided
/// liquidity, paired against ANY standard BEP20 quote token.
///
/// A single `launch` transaction:
///   1. deploys a fixed-supply, hook-free BrewToken via CREATE2;
///   2. creates and initializes the Pancake V3 pool for token/quote at the
///      creator's chosen starting tick (starting market cap);
///   3. mints the entire supply as single-sided V3 liquidity across one or
///      more tick ranges above the starting price — no quote capital needed;
///   4. locks every LP NFT forever in the BrewLiquidityLocker, which streams
///      swap fees to the creator and the protocol treasury;
///   5. optionally executes the creator's first buy atomically (native BNB
///      when the quote is WBNB, or any quote BEP20 via allowance).
///
/// Because the pool lives on the canonical PancakeSwap V3 factory and the
/// token has no transfer hooks, the token is immediately tradeable through
/// the PancakeSwap Universal Router, smart router, and every aggregator that
/// routes Pancake V3 liquidity.
contract BrewFactory is Ownable2Step, ReentrancyGuard, IPancakeV3SwapCallback {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- types

    /// @param tickLower/tickUpper Range in canonical orientation, where price
    /// is quote-per-token and rises with the tick. The factory mirrors ticks
    /// automatically when the pool sorts the token as token1.
    /// @param bps Share of total supply placed in this range, in basis points.
    struct LiquidityPosition {
        int24 tickLower;
        int24 tickUpper;
        uint16 bps;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string metadataURI;
        uint256 totalSupply;
        /// @dev Any standard BEP20 to pair against (WBNB, USDT, CAKE, ...).
        address quoteToken;
        /// @dev Pancake V3 fee tier: 100, 500, 2500 or 10000.
        uint24 fee;
        /// @dev Starting tick (canonical orientation); sets the launch price/market cap.
        int24 initialTick;
        /// @dev Supply curve. Empty means one full range [initialTick, maxUsableTick].
        LiquidityPosition[] positions;
        /// @dev Receiver of the creator share of LP fees; zero defaults to the caller.
        address creatorFeeRecipient;
        /// @dev Optional atomic first buy, denominated in the quote token.
        uint256 initialBuyQuoteAmount;
        /// @dev Slippage floor for the first buy, in launched-token units.
        uint256 initialBuyMinTokensOut;
        /// @dev Receiver of the first buy; zero defaults to the caller.
        address initialBuyRecipient;
        /// @dev Caller-chosen CREATE2 entropy (vanity mining, address prediction).
        bytes32 salt;
        /// @dev The highest launch fee the caller consents to. The launch
        /// reverts if the owner-set fee exceeds this, so a fee change can
        /// never reinterpret value the caller earmarked for the initial buy.
        uint256 maxLaunchFeeWei;
    }

    struct LaunchRecord {
        address token;
        address quoteToken;
        address pool;
        address creator;
        uint24 fee;
        uint64 launchedAtBlock;
    }

    // ------------------------------------------------------------- constants

    uint256 public constant MIN_TOTAL_SUPPLY = 1e18;
    uint256 public constant MAX_TOTAL_SUPPLY = 1e30;
    uint256 public constant MAX_POSITIONS = 10;
    uint256 public constant MAX_LAUNCH_FEE = 5 ether;
    uint16 public constant MAX_PROTOCOL_LP_FEE_BPS = 5000;
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ------------------------------------------------------------ immutables

    IPancakeV3Factory public immutable pancakeV3Factory;
    INonfungiblePositionManager public immutable positionManager;
    address public immutable wbnb;
    BrewLiquidityLocker public immutable locker;

    // ---------------------------------------------------------------- config

    /// @notice Receives launch fees and the protocol share of LP fees.
    address public treasury;
    /// @notice Flat BNB fee charged per launch.
    uint256 public launchFeeWei;
    /// @notice Protocol share of LP swap fees (bps), snapshotted per launch.
    uint16 public protocolLpFeeBps;
    /// @notice Circuit breaker for new launches; never affects live pools.
    bool public paused;

    /// @notice Launch record per token; also the on-chain registry for indexers.
    mapping(address token => LaunchRecord) public launches;
    uint256 public totalLaunches;

    /// @dev Pool allowed to invoke the swap callback during an initial buy.
    address private _activeSwapPool;

    // ---------------------------------------------------------------- events

    event TokenLaunched(
        address indexed token,
        address indexed creator,
        address indexed quoteToken,
        address pool,
        uint24 fee,
        int24 initialTick,
        uint256 totalSupply,
        uint256[] lockedPositionIds,
        string name,
        string symbol,
        string metadataURI
    );
    event InitialBuyExecuted(address indexed token, address indexed recipient, uint256 quoteSpent, uint256 tokensOut);
    event TreasuryUpdated(address indexed treasury);
    event LaunchFeeUpdated(uint256 launchFeeWei);
    event ProtocolLpFeeUpdated(uint16 protocolLpFeeBps);
    event PausedSet(bool paused);

    // ---------------------------------------------------------------- errors

    error LaunchesPaused();
    error ZeroAddress();
    error InvalidName();
    error InvalidSymbol();
    error InvalidMetadataURI();
    error InvalidTotalSupply();
    error InvalidQuoteToken();
    error UnsupportedFeeTier();
    error TickNotAligned();
    error TickOutOfRange();
    error InvalidPositions();
    error InvalidBps();
    error IncorrectNativeValue();
    error SlippageExceeded(uint256 received, uint256 minimum);
    error UnexpectedSwapCallback();
    error ConfigOutOfBounds();
    error NativeTransferFailed();
    error PoolPriceMismatch();
    error LaunchFeeAboveCap(uint256 currentFee, uint256 consentedMax);

    constructor(
        IPancakeV3Factory pancakeV3Factory_,
        INonfungiblePositionManager positionManager_,
        address wbnb_,
        address owner_,
        address treasury_,
        uint256 launchFeeWei_,
        uint16 protocolLpFeeBps_
    ) Ownable(owner_) {
        if (address(pancakeV3Factory_) == address(0) || address(positionManager_) == address(0) || wbnb_ == address(0))
        {
            revert ZeroAddress();
        }
        if (treasury_ == address(0)) revert ZeroAddress();
        if (launchFeeWei_ > MAX_LAUNCH_FEE || protocolLpFeeBps_ > MAX_PROTOCOL_LP_FEE_BPS) revert ConfigOutOfBounds();
        pancakeV3Factory = pancakeV3Factory_;
        positionManager = positionManager_;
        wbnb = wbnb_;
        treasury = treasury_;
        launchFeeWei = launchFeeWei_;
        protocolLpFeeBps = protocolLpFeeBps_;
        locker = new BrewLiquidityLocker(positionManager_, address(this));
    }

    // ---------------------------------------------------------------- launch

    /// @notice Launches a token. See contract docs for the full lifecycle.
    /// Native value rules: send exactly `launchFeeWei` (initial buy pulled from
    /// quote-token allowance), or `launchFeeWei + initialBuyQuoteAmount` when
    /// the quote is WBNB and the first buy is paid in native BNB.
    function launch(LaunchParams calldata params)
        external
        payable
        nonReentrant
        returns (address token, address pool, uint256[] memory positionIds)
    {
        if (paused) revert LaunchesPaused();
        int24 tickSpacing = _validate(params);
        uint256 nativeBuyWei = _collectLaunchFee(params);

        token = _deployToken(params);
        bool tokenIsToken0 = token < params.quoteToken;

        pool = _createPool(token, params, tokenIsToken0);
        positionIds = _mintLockedPositions(token, pool, params, tokenIsToken0, tickSpacing);

        launches[token] = LaunchRecord({
            token: token,
            quoteToken: params.quoteToken,
            pool: pool,
            creator: msg.sender,
            fee: params.fee,
            launchedAtBlock: uint64(block.number)
        });
        totalLaunches += 1;

        emit TokenLaunched(
            token,
            msg.sender,
            params.quoteToken,
            pool,
            params.fee,
            params.initialTick,
            params.totalSupply,
            positionIds,
            params.name,
            params.symbol,
            params.metadataURI
        );

        if (params.initialBuyQuoteAmount > 0) {
            _executeInitialBuy(token, pool, params, tokenIsToken0, nativeBuyWei);
        }
    }

    /// @notice Predicts the CREATE2 address a launch will deploy its token at,
    /// so creators can pre-verify or vanity-mine `salt` off-chain.
    function predictTokenAddress(
        address creator,
        bytes32 salt,
        string calldata name,
        string calldata symbol,
        uint256 totalSupply,
        string calldata metadataURI
    ) external view returns (address) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(BrewToken).creationCode,
                abi.encode(name, symbol, totalSupply, address(this), metadataURI, creator)
            )
        );
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff), address(this), keccak256(abi.encode(creator, salt)), initCodeHash
                        )
                    )
                )
            )
        );
    }

    // ------------------------------------------------------------- internals

    function _validate(LaunchParams calldata params) internal view returns (int24 tickSpacing) {
        if (bytes(params.name).length == 0 || bytes(params.name).length > 64) revert InvalidName();
        if (bytes(params.symbol).length == 0 || bytes(params.symbol).length > 32) revert InvalidSymbol();
        if (bytes(params.metadataURI).length > 2048) revert InvalidMetadataURI();
        if (params.totalSupply < MIN_TOTAL_SUPPLY || params.totalSupply > MAX_TOTAL_SUPPLY) revert InvalidTotalSupply();
        if (params.quoteToken == address(0) || params.quoteToken.code.length == 0) revert InvalidQuoteToken();

        tickSpacing = pancakeV3Factory.feeAmountTickSpacing(params.fee);
        if (tickSpacing <= 0) revert UnsupportedFeeTier();

        int24 maxUsableTick = (TickMath.MAX_TICK / tickSpacing) * tickSpacing;
        if (params.initialTick % tickSpacing != 0) revert TickNotAligned();
        // Both bounds strict: a mirrored launch negates the tick, and pool
        // initialization at exactly ±MAX_TICK is rejected by TickMath.
        if (params.initialTick <= -maxUsableTick || params.initialTick >= maxUsableTick) revert TickOutOfRange();

        uint256 count = params.positions.length;
        if (count > MAX_POSITIONS) revert InvalidPositions();
        uint256 bpsSum = 0;
        for (uint256 i = 0; i < count; i++) {
            LiquidityPosition calldata p = params.positions[i];
            if (p.tickLower % tickSpacing != 0 || p.tickUpper % tickSpacing != 0) revert TickNotAligned();
            if (p.tickLower < params.initialTick || p.tickUpper <= p.tickLower || p.tickUpper > maxUsableTick) {
                revert InvalidPositions();
            }
            if (p.bps == 0) revert InvalidBps();
            bpsSum += p.bps;
        }
        if (count > 0 && bpsSum != BPS_DENOMINATOR) revert InvalidBps();
    }

    function _collectLaunchFee(LaunchParams calldata params) internal returns (uint256 nativeBuyWei) {
        uint256 fee_ = launchFeeWei;
        if (fee_ > params.maxLaunchFeeWei) revert LaunchFeeAboveCap(fee_, params.maxLaunchFeeWei);
        if (msg.value < fee_) revert IncorrectNativeValue();
        nativeBuyWei = msg.value - fee_;
        if (
            nativeBuyWei != 0
                && (params.quoteToken != wbnb || nativeBuyWei != params.initialBuyQuoteAmount)
        ) {
            revert IncorrectNativeValue();
        }
        if (fee_ > 0) {
            (bool ok,) = treasury.call{value: fee_}("");
            if (!ok) revert NativeTransferFailed();
        }
    }

    function _deployToken(LaunchParams calldata params) internal returns (address) {
        BrewToken token = new BrewToken{salt: keccak256(abi.encode(msg.sender, params.salt))}(
            params.name, params.symbol, params.totalSupply, address(this), params.metadataURI, msg.sender
        );
        return address(token);
    }

    function _createPool(address token, LaunchParams calldata params, bool tokenIsToken0)
        internal
        returns (address pool)
    {
        (address token0, address token1) =
            tokenIsToken0 ? (token, params.quoteToken) : (params.quoteToken, token);
        int24 poolTick = tokenIsToken0 ? params.initialTick : -params.initialTick;
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(poolTick);
        pool = positionManager.createAndInitializePoolIfNecessary(token0, token1, params.fee, sqrtPriceX96);
        // A mempool front-runner could pre-create this pool at a hostile price
        // (createAndInitializePoolIfNecessary never re-initializes). Refuse to
        // launch into a mispriced pool; relaunching with a fresh salt evades it.
        (uint160 actualSqrtPriceX96,,,,,,) = IPancakeV3Pool(pool).slot0();
        if (actualSqrtPriceX96 != sqrtPriceX96) revert PoolPriceMismatch();
    }

    function _mintLockedPositions(
        address token,
        address pool,
        LaunchParams calldata params,
        bool tokenIsToken0,
        int24 tickSpacing
    ) internal returns (uint256[] memory positionIds) {
        pool; // pool creation already happened; kept for call-site clarity
        IERC20(token).forceApprove(address(positionManager), params.totalSupply);

        uint256 count = params.positions.length == 0 ? 1 : params.positions.length;
        positionIds = new uint256[](count);
        uint256 remaining = params.totalSupply;
        address creatorRecipient =
            params.creatorFeeRecipient == address(0) ? msg.sender : params.creatorFeeRecipient;
        uint16 protocolBps = protocolLpFeeBps;

        for (uint256 i = 0; i < count; i++) {
            (int24 lower, int24 upper, uint256 amount) = _positionSlice(params, tickSpacing, i, count, remaining);
            remaining -= amount;
            (int24 mintLower, int24 mintUpper) = tokenIsToken0 ? (lower, upper) : (-upper, -lower);

            (uint256 tokenId,,,) = positionManager.mint(
                INonfungiblePositionManager.MintParams({
                    token0: tokenIsToken0 ? token : params.quoteToken,
                    token1: tokenIsToken0 ? params.quoteToken : token,
                    fee: params.fee,
                    tickLower: mintLower,
                    tickUpper: mintUpper,
                    amount0Desired: tokenIsToken0 ? amount : 0,
                    amount1Desired: tokenIsToken0 ? 0 : amount,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(locker),
                    deadline: block.timestamp
                })
            );
            positionIds[i] = tokenId;
            locker.assignPosition(tokenId, token, creatorRecipient, protocolBps);
        }

        IERC20(token).forceApprove(address(positionManager), 0);
        // Rounding leaves a few wei of the supply unplaced; burn them so the
        // entire supply is either pool liquidity or holder balances.
        uint256 dust = IERC20(token).balanceOf(address(this));
        if (dust > 0) IERC20(token).safeTransfer(DEAD, dust);
    }

    function _positionSlice(
        LaunchParams calldata params,
        int24 tickSpacing,
        uint256 i,
        uint256 count,
        uint256 remaining
    ) internal pure returns (int24 lower, int24 upper, uint256 amount) {
        if (params.positions.length == 0) {
            lower = params.initialTick;
            upper = (TickMath.MAX_TICK / tickSpacing) * tickSpacing;
            amount = remaining;
        } else {
            LiquidityPosition calldata p = params.positions[i];
            lower = p.tickLower;
            upper = p.tickUpper;
            amount = i == count - 1 ? remaining : (params.totalSupply * p.bps) / BPS_DENOMINATOR;
        }
    }

    function _executeInitialBuy(
        address token,
        address pool,
        LaunchParams calldata params,
        bool tokenIsToken0,
        uint256 nativeBuyWei
    ) internal {
        uint256 amountIn = params.initialBuyQuoteAmount;
        bool fundedNatively = nativeBuyWei > 0;
        if (fundedNatively) {
            IWBNB(wbnb).deposit{value: nativeBuyWei}();
        } else {
            IERC20(params.quoteToken).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        address recipient = params.initialBuyRecipient == address(0) ? msg.sender : params.initialBuyRecipient;
        bool zeroForOne = !tokenIsToken0; // selling quote for token
        _activeSwapPool = pool;
        (int256 amount0, int256 amount1) = IPancakeV3Pool(pool).swap(
            recipient,
            zeroForOne,
            int256(amountIn),
            zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1,
            abi.encode(params.quoteToken)
        );
        _activeSwapPool = address(0);

        uint256 tokensOut = uint256(-(zeroForOne ? amount1 : amount0));
        uint256 quoteSpent = uint256(zeroForOne ? amount0 : amount1);
        if (tokensOut < params.initialBuyMinTokensOut) {
            revert SlippageExceeded(tokensOut, params.initialBuyMinTokensOut);
        }

        // Refund whatever the pool did not consume (possible if the buy would
        // sweep past the top of the liquidity range). Tracked arithmetic, not
        // balanceOf: stray donations to the factory are never handed out.
        uint256 leftover = amountIn - quoteSpent;
        if (leftover > 0) {
            if (fundedNatively) {
                IWBNB(wbnb).withdraw(leftover);
                (bool ok,) = msg.sender.call{value: leftover}("");
                if (!ok) revert NativeTransferFailed();
            } else {
                IERC20(params.quoteToken).safeTransfer(msg.sender, leftover);
            }
        }

        emit InitialBuyExecuted(token, recipient, quoteSpent, tokensOut);
    }

    /// @inheritdoc IPancakeV3SwapCallback
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        address pool = _activeSwapPool;
        if (pool == address(0) || msg.sender != pool) revert UnexpectedSwapCallback();
        address quoteToken = abi.decode(data, (address));
        uint256 owed = uint256(amount0Delta > 0 ? amount0Delta : amount1Delta);
        if (owed > 0) IERC20(quoteToken).safeTransfer(pool, owed);
    }

    /// @dev Accepts BNB only while unwrapping WBNB for initial-buy refunds.
    receive() external payable {
        if (msg.sender != wbnb) revert IncorrectNativeValue();
    }

    // ----------------------------------------------------------------- admin

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setLaunchFee(uint256 launchFeeWei_) external onlyOwner {
        if (launchFeeWei_ > MAX_LAUNCH_FEE) revert ConfigOutOfBounds();
        launchFeeWei = launchFeeWei_;
        emit LaunchFeeUpdated(launchFeeWei_);
    }

    function setProtocolLpFeeBps(uint16 protocolLpFeeBps_) external onlyOwner {
        if (protocolLpFeeBps_ > MAX_PROTOCOL_LP_FEE_BPS) revert ConfigOutOfBounds();
        protocolLpFeeBps = protocolLpFeeBps_;
        emit ProtocolLpFeeUpdated(protocolLpFeeBps_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }
}

// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)


/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// OpenZeppelin Contracts (last updated v5.3.0) (token/ERC20/utils/SafeERC20.sol)



/**
 * @title SafeERC20
 * @dev Wrappers around ERC-20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    /**
     * @dev An operation with an ERC-20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    /**
     * @dev Variant of {safeTransfer} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransfer(IERC20 token, address to, uint256 value) internal returns (bool) {
        return _callOptionalReturnBool(token, abi.encodeCall(token.transfer, (to, value)));
    }

    /**
     * @dev Variant of {safeTransferFrom} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransferFrom(IERC20 token, address from, address to, uint256 value) internal returns (bool) {
        return _callOptionalReturnBool(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     *
     * NOTE: If the token implements ERC-7674, this function will not modify any temporary allowance. This function
     * only sets the "standard" allowance. Any temporary allowance will remain active, in addition to the value being
     * set here.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    /**
     * @dev Performs an {ERC1363} transferAndCall, with a fallback to the simple {ERC20} transfer if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferFromAndCall, with a fallback to the simple {ERC20} transferFrom if the target
     * has no code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} approveAndCall, with a fallback to the simple {ERC20} approve if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * NOTE: When the recipient address (`to`) has no code (i.e. is an EOA), this function behaves as {forceApprove}.
     * Opposedly, when the recipient address (`to`) has code, this function only attempts to call {ERC1363-approveAndCall}
     * once without retrying, and relies on the returned value to be true.
     *
     * Reverts if the returned value is other than `true`.
     */
    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturnBool} that reverts if call fails to meet the requirements.
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            let success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            // bubble errors
            if iszero(success) {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize())
                revert(ptr, returndatasize())
            }
            returnSize := returndatasize()
            returnValue := mload(0)
        }

        if (returnSize == 0 ? address(token).code.length == 0 : returnValue != 1) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturn} that silently catches all reverts and returns a bool instead.
     */
    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        bool success;
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            returnSize := returndatasize()
            returnValue := mload(0)
        }
        return success && (returnSize == 0 ? address(token).code.length > 0 : returnValue == 1);
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)



/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// OpenZeppelin Contracts (last updated v5.1.0) (access/Ownable2Step.sol)



/**
 * @dev Contract module which provides access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This extension of the {Ownable} contract includes a two-step mechanism to transfer
 * ownership, where the new owner must call {acceptOwnership} in order to replace the
 * old one. This can help prevent common mistakes, such as transfers of ownership to
 * incorrect accounts, or to contracts that are unable to interact with the
 * permission system.
 *
 * The initial owner is specified at deployment time in the constructor for `Ownable`. This
 * can later be changed with {transferOwnership} and {acceptOwnership}.
 *
 * This module is used through inheritance. It will make available all functions
 * from parent (Ownable).
 */
abstract contract Ownable2Step is Ownable {
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Returns the address of the pending owner.
     */
    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    /**
     * @dev Starts the ownership transfer of the contract to a new account. Replaces the pending transfer if there is one.
     * Can only be called by the current owner.
     *
     * Setting `newOwner` to the zero address is allowed; this can be used to cancel an initiated ownership transfer.
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`) and deletes any pending owner.
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual override {
        delete _pendingOwner;
        super._transferOwnership(newOwner);
    }

    /**
     * @dev The new owner accepts the ownership transfer.
     */
    function acceptOwnership() public virtual {
        address sender = _msgSender();
        if (pendingOwner() != sender) {
            revert OwnableUnauthorizedAccount(sender);
        }
        _transferOwnership(sender);
    }
}

// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)


/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


/// @title Math library for computing sqrt prices from ticks and vice versa
/// @notice Computes sqrt price for ticks of size 1.0001, i.e. sqrt(1.0001^tick) as fixed point Q64.96 numbers. Supports
/// prices between 2**-128 and 2**128
library TickMath {
    error T();
    error R();

    /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128
    int24 internal constant MIN_TICK = -887272;
    /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
    int24 internal constant MAX_TICK = -MIN_TICK;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    /// @notice Calculates sqrt(1.0001^tick) * 2^96
    /// @dev Throws if |tick| > max tick
    /// @param tick The input tick for the above formula
    /// @return sqrtPriceX96 A Fixed point Q64.96 number representing the sqrt of the ratio of the two assets (token1/token0)
    /// at the given tick
    function getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        unchecked {
            uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
            if (absTick > uint256(int256(MAX_TICK))) revert T();

            uint256 ratio = absTick & 0x1 != 0
                ? 0xfffcb933bd6fad37aa2d162d1a594001
                : 0x100000000000000000000000000000000;
            if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
            if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
            if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
            if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
            if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
            if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
            if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
            if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
            if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
            if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
            if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
            if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
            if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
            if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
            if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
            if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
            if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
            if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
            if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

            if (tick > 0) ratio = type(uint256).max / ratio;

            // this divides by 1<<32 rounding up to go from a Q128.128 to a Q128.96.
            // we then downcast because we know the result always fits within 160 bits due to our tick input constraint
            // we round up in the division so getTickAtSqrtRatio of the output price is always consistent
            sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
        }
    }

    /// @notice Calculates the greatest tick value such that getRatioAtTick(tick) <= ratio
    /// @dev Throws in case sqrtPriceX96 < MIN_SQRT_RATIO, as MIN_SQRT_RATIO is the lowest value getRatioAtTick may
    /// ever return.
    /// @param sqrtPriceX96 The sqrt ratio for which to compute the tick as a Q64.96
    /// @return tick The greatest tick for which the ratio is less than or equal to the input ratio
    function getTickAtSqrtRatio(uint160 sqrtPriceX96) internal pure returns (int24 tick) {
        unchecked {
            // second inequality must be < because the price can never reach the price at the max tick
            if (!(sqrtPriceX96 >= MIN_SQRT_RATIO && sqrtPriceX96 < MAX_SQRT_RATIO)) revert R();
            uint256 ratio = uint256(sqrtPriceX96) << 32;

            uint256 r = ratio;
            uint256 msb = 0;

            assembly {
                let f := shl(7, gt(r, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(6, gt(r, 0xFFFFFFFFFFFFFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(5, gt(r, 0xFFFFFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(4, gt(r, 0xFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(3, gt(r, 0xFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(2, gt(r, 0xF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(1, gt(r, 0x3))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := gt(r, 0x1)
                msb := or(msb, f)
            }

            if (msb >= 128) r = ratio >> (msb - 127);
            else r = ratio << (127 - msb);

            int256 log_2 = (int256(msb) - 128) << 64;

            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(63, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(62, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(61, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(60, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(59, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(58, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(57, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(56, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(55, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(54, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(53, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(52, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(51, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(50, f))
            }

            int256 log_sqrt10001 = log_2 * 255738958999603826347141; // 128.128 number

            int24 tickLow = int24((log_sqrt10001 - 3402992956809132418596140100660247210) >> 128);
            int24 tickHi = int24((log_sqrt10001 + 291339464771989622907027621153398088495) >> 128);

            tick = tickLow == tickHi ? tickLow : getSqrtRatioAtTick(tickHi) <= sqrtPriceX96 ? tickHi : tickLow;
        }
    }
}



/// @title BrewToken
/// @notice A deliberately boring BEP20: fixed supply minted once at construction,
/// 18 decimals, no owner, no mint, no taxes, no transfer hooks, no blacklist, no
/// pausing. Every unit is transferable by any router, aggregator, or wallet from
/// the first block, which is what makes Brew launches universally tradeable.
contract BrewToken is ERC20 {
    /// @notice The wallet that launched this token through the Brew factory.
    address public immutable creator;

    /// @notice The Brew factory that deployed this token.
    address public immutable brewFactory;

    /// @notice Immutable off-chain metadata pointer (image, description, socials).
    string public metadataURI;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address recipient_,
        string memory metadataURI_,
        address creator_
    ) ERC20(name_, symbol_) {
        creator = creator_;
        brewFactory = msg.sender;
        metadataURI = metadataURI_;
        _mint(recipient_, totalSupply_);
    }

    /// @notice ERC721-style alias so explorers and indexers find the metadata.
    function tokenURI() external view returns (string memory) {
        return metadataURI;
    }
}



interface IBrewFeeConfig {
    function treasury() external view returns (address);
}

/// @title BrewLiquidityLocker
/// @notice Permanent vault for the PancakeSwap V3 LP NFTs minted at launch.
/// There is deliberately no function that can decrease liquidity, transfer a
/// position out, or approve an operator: once a position arrives it can never
/// leave, so launch liquidity is provably locked forever.
///
/// The only value that ever exits is accrued swap fees. Anyone may trigger
/// collection; the pool tax then settles like this:
///   - the LAUNCHED-token side of the fees is BURNED in full — neither the
///     creator nor the protocol ever holds or sells a token launched through
///     Brew, and every sell permanently deflates the supply;
///   - the QUOTE (paired token) side is split creator/protocol by the ratio
///     snapshotted at launch (50/50 at the default configuration) and credited
///     to pull-based balances — creators and the protocol each claim their own
///     earnings whenever they choose, so one blocked recipient can never jam
///     collection for everyone else.
contract BrewLiquidityLocker is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct LockedPosition {
        /// @dev BrewToken this position belongs to (zero until assigned).
        address token;
        /// @dev Receiver of the creator's share of swap fees.
        address creatorFeeRecipient;
        /// @dev Protocol share of collected fees in basis points, snapshotted at launch.
        uint16 protocolFeeBps;
    }

    uint256 internal constant BPS_DENOMINATOR = 10_000;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    /// @notice PancakeSwap V3 position manager whose NFTs this locker accepts.
    INonfungiblePositionManager public immutable positionManager;

    /// @notice The Brew factory allowed to assign fee routing for new positions.
    address public immutable brewFactory;

    /// @notice Fee routing per locked position id.
    mapping(uint256 tokenId => LockedPosition) public lockedPositions;

    /// @notice All locked position ids for a launched token.
    mapping(address token => uint256[]) internal _positionsOf;

    /// @notice Pull-based fee balances: account => currency => claimable amount.
    mapping(address account => mapping(address currency => uint256)) public claimableFees;

    event PositionLocked(uint256 indexed tokenId);
    event PositionAssigned(
        uint256 indexed tokenId, address indexed token, address indexed creatorFeeRecipient, uint16 protocolFeeBps
    );
    event CreatorFeeRecipientUpdated(
        uint256 indexed tokenId, address indexed previousRecipient, address indexed newRecipient
    );
    event FeesCollected(
        uint256 indexed tokenId,
        address indexed token,
        address caller,
        address quoteCurrency,
        uint256 creatorQuoteAmount,
        uint256 protocolQuoteAmount,
        uint256 tokensBurned
    );
    event FeesClaimed(address indexed account, address indexed currency, address indexed to, uint256 amount);

    error OnlyPositionManagerNFTs();
    error OnlyBrewFactory();
    error OnlyCreatorFeeRecipient();
    error ZeroAddress();
    error PositionNotHeld(uint256 tokenId);
    error PositionAlreadyAssigned(uint256 tokenId);
    error PositionNotAssigned(uint256 tokenId);
    error InvalidProtocolFee();
    error NothingToClaim();

    constructor(INonfungiblePositionManager positionManager_, address brewFactory_) {
        if (address(positionManager_) == address(0) || brewFactory_ == address(0)) revert ZeroAddress();
        positionManager = positionManager_;
        brewFactory = brewFactory_;
    }

    /// @notice Accepts LP NFTs, but only ones minted by the configured position manager.
    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        if (msg.sender != address(positionManager)) revert OnlyPositionManagerNFTs();
        emit PositionLocked(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Called by the factory right after minting a launch position to wire up fee routing.
    function assignPosition(uint256 tokenId, address token, address creatorFeeRecipient, uint16 protocolFeeBps)
        external
    {
        if (msg.sender != brewFactory) revert OnlyBrewFactory();
        if (token == address(0) || creatorFeeRecipient == address(0)) revert ZeroAddress();
        if (protocolFeeBps > BPS_DENOMINATOR / 2) revert InvalidProtocolFee();
        if (positionManager.ownerOf(tokenId) != address(this)) revert PositionNotHeld(tokenId);
        if (lockedPositions[tokenId].token != address(0)) revert PositionAlreadyAssigned(tokenId);

        lockedPositions[tokenId] =
            LockedPosition({token: token, creatorFeeRecipient: creatorFeeRecipient, protocolFeeBps: protocolFeeBps});
        _positionsOf[token].push(tokenId);
        emit PositionAssigned(tokenId, token, creatorFeeRecipient, protocolFeeBps);
    }

    /// @notice Collects accrued swap fees for one locked position, credits the
    /// creator and treasury pull-balances, and burns the protocol's share of
    /// the launched token. Callable by anyone.
    function collectFees(uint256 tokenId) public nonReentrant returns (uint256 amount0, uint256 amount1) {
        LockedPosition memory locked = lockedPositions[tokenId];
        if (locked.token == address(0)) revert PositionNotAssigned(tokenId);

        (,, address token0, address token1,,,,,,,,) = positionManager.positions(tokenId);
        // Credit only what actually arrives (balance deltas), not what the
        // position manager reports: a quote token that skims transfers can
        // then only shortchange its own launches, never make the shared
        // claimable pool insolvent for other currencies or recipients.
        uint256 balance0Before = IERC20(token0).balanceOf(address(this));
        uint256 balance1Before = IERC20(token1).balanceOf(address(this));
        positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        amount0 = IERC20(token0).balanceOf(address(this)) - balance0Before;
        amount1 = IERC20(token1).balanceOf(address(this)) - balance1Before;

        (uint256 tokenSideAmount, uint256 quoteSideAmount, address quoteCurrency) =
            token0 == locked.token ? (amount0, amount1, token1) : (amount1, amount0, token0);

        // Quote side: creator/protocol split at the launch-time snapshot,
        // credited for pull-based claiming.
        uint256 protocolQuote = (quoteSideAmount * locked.protocolFeeBps) / BPS_DENOMINATOR;
        uint256 creatorQuote = quoteSideAmount - protocolQuote;
        if (creatorQuote > 0) claimableFees[locked.creatorFeeRecipient][quoteCurrency] += creatorQuote;
        if (protocolQuote > 0) {
            claimableFees[IBrewFeeConfig(brewFactory).treasury()][quoteCurrency] += protocolQuote;
        }

        // Launched-token side: burned in full. BrewTokens are hook-free, so
        // the burn cannot revert or be blocked.
        if (tokenSideAmount > 0) IERC20(locked.token).safeTransfer(DEAD, tokenSideAmount);

        emit FeesCollected(
            tokenId, locked.token, msg.sender, quoteCurrency, creatorQuote, protocolQuote, tokenSideAmount
        );
    }

    /// @notice Collects fees across every position locked for a launched token.
    function collectAllFees(address token) external returns (uint256 total0, uint256 total1) {
        uint256[] memory ids = _positionsOf[token];
        for (uint256 i = 0; i < ids.length; i++) {
            (uint256 a0, uint256 a1) = collectFees(ids[i]);
            total0 += a0;
            total1 += a1;
        }
    }

    /// @notice Sends the caller's accrued fee balance for one currency to `to`.
    /// Pays out at most the locker's actual balance and reduces the credit
    /// only by what was paid, so a currency that misbehaves (rebases down,
    /// misreports) can delay its own claims but never permanently brick them.
    function claimFees(address currency, address to) external nonReentrant returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        uint256 credit = claimableFees[msg.sender][currency];
        uint256 available = IERC20(currency).balanceOf(address(this));
        amount = credit <= available ? credit : available;
        if (amount == 0) revert NothingToClaim();
        claimableFees[msg.sender][currency] = credit - amount;
        IERC20(currency).safeTransfer(to, amount);
        emit FeesClaimed(msg.sender, currency, to, amount);
    }

    /// @notice Lets the current creator fee recipient hand fee rights to a new address.
    /// Already-accrued claimable balances stay with the previous recipient.
    function setCreatorFeeRecipient(uint256 tokenId, address newRecipient) external {
        LockedPosition storage locked = lockedPositions[tokenId];
        if (locked.token == address(0)) revert PositionNotAssigned(tokenId);
        if (msg.sender != locked.creatorFeeRecipient) revert OnlyCreatorFeeRecipient();
        if (newRecipient == address(0)) revert ZeroAddress();
        emit CreatorFeeRecipientUpdated(tokenId, locked.creatorFeeRecipient, newRecipient);
        locked.creatorFeeRecipient = newRecipient;
    }

    /// @notice Position ids locked for a launched token.
    function positionsOf(address token) external view returns (uint256[] memory) {
        return _positionsOf[token];
    }
}


/// @dev Minimal PancakeSwap V3 factory surface used by Brew.
interface IPancakeV3Factory {
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

/// @dev Minimal PancakeSwap V3 pool surface used by Brew.
/// Note: Pancake's slot0 differs from Uniswap (uint32 feeProtocol).
interface IPancakeV3Pool {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint32 feeProtocol,
            bool unlocked
        );

    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    function liquidity() external view returns (uint128);

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

/// @dev Callback the pool invokes on the swap initiator; Pancake renames Uniswap's callback.
interface IPancakeV3SwapCallback {
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

/// @dev Minimal PancakeSwap V3 NonfungiblePositionManager surface used by Brew.
/// Struct layouts match pancake-v3-contracts (identical to Uniswap V3 periphery).
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96)
        external
        payable
        returns (address pool);

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);

    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    function ownerOf(uint256 tokenId) external view returns (address);
    function factory() external view returns (address);
    function WETH9() external view returns (address);
}

/// @dev Wrapped BNB.
interface IWBNB {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC1363.sol)



/**
 * @title IERC1363
 * @dev Interface of the ERC-1363 standard as defined in the https://eips.ethereum.org/EIPS/eip-1363[ERC-1363].
 *
 * Defines an extension interface for ERC-20 tokens that supports executing code on a recipient contract
 * after `transfer` or `transferFrom`, or code on a spender contract after `approve`, in a single transaction.
 */
interface IERC1363 is IERC20, IERC165 {
    /*
     * Note: the ERC-165 identifier for this interface is 0xb0202a11.
     * 0xb0202a11 ===
     *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
     *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
     */

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @param data Additional data with no specified format, sent in call to `spender`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)


/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/ERC20.sol)



/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.openzeppelin.com/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * The default value of {decimals} is 18. To change this, you should override
 * this function so it returns a different value.
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC-20
 * applications.
 */
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;

    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * Both values are immutable: they can only be set once during construction.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /// @inheritdoc IERC20
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /// @inheritdoc IERC20
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /// @inheritdoc IERC20
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Skips emitting an {Approval} event indicating an allowance update. This is not
     * required by the ERC. See {xref-ERC20-_approve-address-address-uint256-bool-}[_approve].
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, lowering the total supply.
     * Relies on the `_update` mechanism.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead
     */
    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over the `owner`'s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     *
     * Overrides to this logic should be done to the variant with an additional `bool emitEvent` argument.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    /**
     * @dev Variant of {_approve} with an optional flag to enable or disable the {Approval} event.
     *
     * By default (when calling {_approve}) the flag is set to true. On the other hand, approval changes made by
     * `_spendAllowance` during the `transferFrom` operation set the flag to false. This saves gas by not emitting any
     * `Approval` event during `transferFrom` operations.
     *
     * Anyone who wishes to continue emitting `Approval` events on the`transferFrom` operation can force the flag to
     * true using the following override:
     *
     * ```solidity
     * function _approve(address owner, address spender, uint256 value, bool) internal virtual override {
     *     super._approve(owner, spender, value, true);
     * }
     * ```
     *
     * Requirements are the same as {_approve}.
     */
    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    /**
     * @dev Updates `owner`'s allowance for `spender` based on spent `value`.
     *
     * Does not update the allowance value in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Does not emit an {Approval} event.
     */
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}

// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC721/IERC721Receiver.sol)


/**
 * @title ERC-721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC-721 asset contracts.
 */
interface IERC721Receiver {
    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be
     * reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC20.sol)



// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC165.sol)



// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/extensions/IERC20Metadata.sol)



/**
 * @dev Interface for the optional metadata functions from the ERC-20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/draft-IERC6093.sol)

/**
 * @dev Standard ERC-20 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-20 tokens.
 */
interface IERC20Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC20InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC20InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `spender`’s `allowance`. Used in transfers.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     * @param allowance Amount of tokens a `spender` is allowed to operate with.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC20InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `spender` to be approved. Used in approvals.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC20InvalidSpender(address spender);
}

/**
 * @dev Standard ERC-721 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-721 tokens.
 */
interface IERC721Errors {
    /**
     * @dev Indicates that an address can't be an owner. For example, `address(0)` is a forbidden owner in ERC-20.
     * Used in balance queries.
     * @param owner Address of the current owner of a token.
     */
    error ERC721InvalidOwner(address owner);

    /**
     * @dev Indicates a `tokenId` whose `owner` is the zero address.
     * @param tokenId Identifier number of a token.
     */
    error ERC721NonexistentToken(uint256 tokenId);

    /**
     * @dev Indicates an error related to the ownership over a particular token. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param tokenId Identifier number of a token.
     * @param owner Address of the current owner of a token.
     */
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC721InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC721InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param tokenId Identifier number of a token.
     */
    error ERC721InsufficientApproval(address operator, uint256 tokenId);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC721InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC721InvalidOperator(address operator);
}

/**
 * @dev Standard ERC-1155 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-1155 tokens.
 */
interface IERC1155Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     * @param tokenId Identifier number of a token.
     */
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC1155InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC1155InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param owner Address of the current owner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address owner);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC1155InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC1155InvalidOperator(address operator);

    /**
     * @dev Indicates an array length mismatch between ids and values in a safeBatchTransferFrom operation.
     * Used in batch transfers.
     * @param idsLength Length of the array of token identifiers
     * @param valuesLength Length of the array of token amounts
     */
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
}

// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)


/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

{
  "remappings": [
    "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",
    "forge-std/=lib/forge-std/src/",
    "openzeppelin-contracts/=lib/openzeppelin-contracts/contracts/"
  ],
  "optimizer": {
    "enabled": true,
    "runs": 800
  },
  "metadata": {
    "useLiteralContent": false,
    "bytecodeHash": "ipfs",
    "appendCBOR": true
  },
  "outputSelection": {
    "*": {
      "*": [
        "evm.bytecode",
        "evm.deployedBytecode",
        "devdoc",
        "userdoc",
        "metadata",
        "abi"
      ]
    }
  },
  "evmVersion": "cancun",
  "viaIR": true
}
