// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    EagleToken,
    IERC20,
    IERC721Receiver,
    IWBNB,
    Ownable,
    Ownable2Step,
    ReentrancyGuard,
    SafeERC20,
    TickMath
} from "./BrewLaunchSuite.sol";

library FullMath {
    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly ("memory-safe") {
                let mm := mulmod(a, b, not(0))
                prod0 := mul(a, b)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            if (prod1 == 0) {
                return prod0 / denominator;
            }

            require(denominator > prod1, "mulDiv overflow");

            uint256 remainder;
            assembly ("memory-safe") {
                remainder := mulmod(a, b, denominator)
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            uint256 twos = denominator & (~denominator + 1);
            assembly ("memory-safe") {
                denominator := div(denominator, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }

            prod0 |= prod1 * twos;

            uint256 inverse = (3 * denominator) ^ 2;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;

            result = prod0 * inverse;
            return result;
        }
    }
}

library RobinhoodV4Actions {
    uint8 internal constant INCREASE_LIQUIDITY = 0x00;
    uint8 internal constant DECREASE_LIQUIDITY = 0x01;
    uint8 internal constant MINT_POSITION = 0x02;
    uint8 internal constant SETTLE_PAIR = 0x0d;
    uint8 internal constant TAKE_PAIR = 0x11;
}

library RobinhoodV4SwapActions {
    uint8 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 internal constant SETTLE_ALL = 0x0c;
    uint8 internal constant TAKE_ALL = 0x0f;
}

library RobinhoodUniversalRouterCommands {
    bytes1 internal constant V4_SWAP = 0x10;
}

struct V4PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

interface IUniswapV4PoolManager {
    function initialize(V4PoolKey memory key, uint160 sqrtPriceX96) external returns (int24);
}

struct V4ExactInputSingleParams {
    V4PoolKey poolKey;
    bool zeroForOne;
    uint128 amountIn;
    uint128 amountOutMinimum;
    bytes hookData;
}

interface IUniswapV4PositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function nextTokenId() external view returns (uint256 tokenId);
    function permit2() external view returns (address permit2_);
}

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface IPermit2AllowanceTransfer {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IZeroV4FeeConfig {
    function treasury() external view returns (address);
}

contract ZeroLiquidityLocker is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant EAGLE = "launch on eagle.family";

    struct LockedPosition {
        address token;
        address quoteToken;
        address creatorFeeRecipient;
        uint16 protocolFeeBps;
    }

    uint256 internal constant BPS_DENOMINATOR = 10_000;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IUniswapV4PositionManager public immutable positionManager;
    address public immutable brewFactory;
    uint256 public lastReceivedTokenId;

    mapping(uint256 tokenId => LockedPosition) public lockedPositions;
    mapping(address token => uint256[]) internal _positionsOf;
    mapping(address account => mapping(address currency => uint256)) public claimableFees;

    event PositionLocked(uint256 indexed tokenId);
    event PositionAssigned(
        uint256 indexed tokenId,
        address indexed token,
        address indexed quoteToken,
        address creatorFeeRecipient,
        uint16 protocolFeeBps
    );
    event CreatorFeeRecipientUpdated(
        uint256 indexed tokenId, address indexed previousRecipient, address indexed newRecipient
    );
    event FeesCollected(
        uint256 indexed tokenId,
        address indexed token,
        address caller,
        uint256 creatorTokenAmount,
        uint256 protocolTokenAmount,
        address quoteCurrency,
        uint256 creatorQuoteAmount,
        uint256 protocolQuoteAmount
    );
    event FeesClaimed(address indexed account, address indexed currency, address indexed to, uint256 amount);

    error OnlyPositionManagerNFTs();
    error OnlyZeroFactory();
    error OnlyCreatorFeeRecipient();
    error ZeroAddress();
    error PositionNotHeld(uint256 tokenId);
    error PositionAlreadyAssigned(uint256 tokenId);
    error PositionNotAssigned(uint256 tokenId);
    error InvalidProtocolFee();
    error NothingToClaim();

    constructor(IUniswapV4PositionManager positionManager_, address brewFactory_) {
        if (address(positionManager_) == address(0) || brewFactory_ == address(0)) revert ZeroAddress();
        positionManager = positionManager_;
        brewFactory = brewFactory_;
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        if (msg.sender != address(positionManager)) revert OnlyPositionManagerNFTs();
        lastReceivedTokenId = tokenId;
        emit PositionLocked(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function assignPosition(
        uint256 tokenId,
        address token,
        address quoteToken,
        address creatorFeeRecipient,
        uint16 protocolFeeBps
    ) external {
        if (msg.sender != brewFactory) revert OnlyZeroFactory();
        if (token == address(0) || quoteToken == address(0) || creatorFeeRecipient == address(0)) revert ZeroAddress();
        if (protocolFeeBps > BPS_DENOMINATOR / 2) revert InvalidProtocolFee();
        if (positionManager.ownerOf(tokenId) != address(this)) revert PositionNotHeld(tokenId);
        if (lockedPositions[tokenId].token != address(0)) revert PositionAlreadyAssigned(tokenId);

        lockedPositions[tokenId] = LockedPosition({
            token: token,
            quoteToken: quoteToken,
            creatorFeeRecipient: creatorFeeRecipient,
            protocolFeeBps: protocolFeeBps
        });
        _positionsOf[token].push(tokenId);
        emit PositionAssigned(tokenId, token, quoteToken, creatorFeeRecipient, protocolFeeBps);
    }

    function collectFees(uint256 tokenId) public nonReentrant returns (uint256 amount0, uint256 amount1) {
        LockedPosition memory locked = lockedPositions[tokenId];
        if (locked.token == address(0)) revert PositionNotAssigned(tokenId);

        (address currency0, address currency1) =
            locked.token < locked.quoteToken ? (locked.token, locked.quoteToken) : (locked.quoteToken, locked.token);

        uint256 balance0Before = IERC20(currency0).balanceOf(address(this));
        uint256 balance1Before = IERC20(currency1).balanceOf(address(this));

        bytes memory actions =
            abi.encodePacked(RobinhoodV4Actions.DECREASE_LIQUIDITY, RobinhoodV4Actions.TAKE_PAIR);
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(currency0, currency1, address(this));
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        amount0 = IERC20(currency0).balanceOf(address(this)) - balance0Before;
        amount1 = IERC20(currency1).balanceOf(address(this)) - balance1Before;

        (uint256 tokenSideAmount, uint256 quoteSideAmount, address quoteCurrency) =
            currency0 == locked.token ? (amount0, amount1, currency1) : (amount1, amount0, currency0);

        uint256 protocolToken = (tokenSideAmount * locked.protocolFeeBps) / BPS_DENOMINATOR;
        uint256 creatorToken = tokenSideAmount - protocolToken;
        uint256 protocolQuote = (quoteSideAmount * locked.protocolFeeBps) / BPS_DENOMINATOR;
        uint256 creatorQuote = quoteSideAmount - protocolQuote;
        if (creatorToken > 0) claimableFees[locked.creatorFeeRecipient][locked.token] += creatorToken;
        if (creatorQuote > 0) claimableFees[locked.creatorFeeRecipient][quoteCurrency] += creatorQuote;
        address treasury = IZeroV4FeeConfig(brewFactory).treasury();
        if (protocolToken > 0) claimableFees[treasury][locked.token] += protocolToken;
        if (protocolQuote > 0) claimableFees[treasury][quoteCurrency] += protocolQuote;

        emit FeesCollected(
            tokenId, locked.token, msg.sender, creatorToken, protocolToken, quoteCurrency, creatorQuote, protocolQuote
        );
    }

    function collectAllFees(address token) external returns (uint256 total0, uint256 total1) {
        uint256[] memory ids = _positionsOf[token];
        for (uint256 i = 0; i < ids.length; i++) {
            (uint256 a0, uint256 a1) = collectFees(ids[i]);
            total0 += a0;
            total1 += a1;
        }
    }

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

    function setCreatorFeeRecipient(uint256 tokenId, address newRecipient) external {
        LockedPosition storage locked = lockedPositions[tokenId];
        if (locked.token == address(0)) revert PositionNotAssigned(tokenId);
        if (msg.sender != locked.creatorFeeRecipient) revert OnlyCreatorFeeRecipient();
        if (newRecipient == address(0)) revert ZeroAddress();
        emit CreatorFeeRecipientUpdated(tokenId, locked.creatorFeeRecipient, newRecipient);
        locked.creatorFeeRecipient = newRecipient;
    }

    function positionsOf(address token) external view returns (uint256[] memory) {
        return _positionsOf[token];
    }
}

contract ZeroFactory is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant EAGLE = "launch on eagle.family";

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
        address quoteToken;
        uint24 fee;
        int24 tickSpacing;
        int24 initialTick;
        address hooks;
        LiquidityPosition[] positions;
        address creatorFeeRecipient;
        uint256 initialBuyQuoteAmount;
        uint256 initialBuyMinTokensOut;
        address initialBuyRecipient;
        bytes32 salt;
        uint256 maxLaunchFeeWei;
    }

    struct LaunchRecord {
        address token;
        address quoteToken;
        address creator;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        bytes32 poolId;
        uint64 launchedAtBlock;
    }

    uint256 public constant MIN_TOTAL_SUPPLY = 1e18;
    uint256 public constant MAX_TOTAL_SUPPLY = 1e30;
    uint256 public constant MAX_POSITIONS = 10;
    uint256 public constant MAX_LAUNCH_FEE = 5 ether;
    uint24 public constant MAX_POOL_FEE = 1_000_000;
    uint16 public constant MAX_PROTOCOL_LP_FEE_BPS = 5000;
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant Q96 = 0x1000000000000000000000000;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IUniswapV4PoolManager public immutable poolManager;
    IUniswapV4PositionManager public immutable positionManager;
    address public immutable wrappedNative;
    address public immutable universalRouter;
    ZeroLiquidityLocker public immutable locker;

    address public treasury;
    uint256 public launchFeeWei;
    uint16 public protocolLpFeeBps;
    bool public paused;

    mapping(address token => LaunchRecord) public launches;
    uint256 public totalLaunches;

    event TokenLaunched(
        address indexed token,
        address indexed creator,
        address indexed quoteToken,
        bytes32 poolId,
        uint24 fee,
        int24 tickSpacing,
        int24 initialTick,
        uint256 totalSupply,
        uint256[] lockedPositionIds,
        string name,
        string symbol,
        string metadataURI
    );
    event TreasuryUpdated(address indexed treasury);
    event LaunchFeeUpdated(uint256 launchFeeWei);
    event ProtocolLpFeeUpdated(uint16 protocolLpFeeBps);
    event PausedSet(bool paused);
    event InitialBuyExecuted(address indexed token, address indexed recipient, uint256 quoteSpent, uint256 tokensOut);

    error LaunchesPaused();
    error ZeroAddress();
    error InvalidName();
    error InvalidSymbol();
    error InvalidMetadataURI();
    error InvalidTotalSupply();
    error InvalidQuoteToken();
    error InvalidPoolFee();
    error InvalidTickSpacing();
    error TickNotAligned();
    error TickOutOfRange();
    error InvalidPositions();
    error InvalidBps();
    error IncorrectNativeValue();
    error ConfigOutOfBounds();
    error NativeTransferFailed();
    error LaunchFeeAboveCap(uint256 currentFee, uint256 consentedMax);
    error AmountTooLarge();
    error PositionMintFailed();

    constructor(
        IUniswapV4PoolManager poolManager_,
        IUniswapV4PositionManager positionManager_,
        address wrappedNative_,
        address universalRouter_,
        address owner_,
        address treasury_,
        uint256 launchFeeWei_,
        uint16 protocolLpFeeBps_
    ) Ownable(owner_) {
        if (
            address(poolManager_) == address(0) || address(positionManager_) == address(0) || wrappedNative_ == address(0)
                || universalRouter_ == address(0)
        )
        {
            revert ZeroAddress();
        }
        if (treasury_ == address(0)) revert ZeroAddress();
        if (launchFeeWei_ > MAX_LAUNCH_FEE || protocolLpFeeBps_ > MAX_PROTOCOL_LP_FEE_BPS) revert ConfigOutOfBounds();
        poolManager = poolManager_;
        positionManager = positionManager_;
        wrappedNative = wrappedNative_;
        universalRouter = universalRouter_;
        treasury = treasury_;
        launchFeeWei = launchFeeWei_;
        protocolLpFeeBps = protocolLpFeeBps_;
        locker = new ZeroLiquidityLocker(positionManager_, address(this));
    }

    function launch(LaunchParams calldata params)
        external
        payable
        nonReentrant
        returns (address token, bytes32 poolId, uint256[] memory positionIds)
    {
        if (paused) revert LaunchesPaused();
        _validate(params);
        uint256 nativeInitialBuyWei = _collectLaunchFee(params);

        token = _deployToken(params);
        V4PoolKey memory poolKey = _poolKey(token, params.quoteToken, params.fee, params.tickSpacing, params.hooks);
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(_poolTick(token, params.quoteToken, params.initialTick));
        poolManager.initialize(poolKey, sqrtPriceX96);
        positionIds = _mintLockedPositions(token, poolKey, params);
        _executeInitialBuy(token, poolKey, params, nativeInitialBuyWei);
        poolId = _poolId(poolKey);

        launches[token] = LaunchRecord({
            token: token,
            quoteToken: params.quoteToken,
            creator: msg.sender,
            fee: params.fee,
            tickSpacing: params.tickSpacing,
            hooks: params.hooks,
            poolId: poolId,
            launchedAtBlock: uint64(block.number)
        });
        totalLaunches += 1;

        emit TokenLaunched(
            token,
            msg.sender,
            params.quoteToken,
            poolId,
            params.fee,
            params.tickSpacing,
            params.initialTick,
            params.totalSupply,
            positionIds,
            params.name,
            params.symbol,
            params.metadataURI
        );
    }

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
                type(EagleToken).creationCode,
                abi.encode(name, symbol, totalSupply, address(this), metadataURI, creator)
            )
        );
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), address(this), keccak256(abi.encode(creator, salt)), initCodeHash)
                    )
                )
            )
        );
    }

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

    function setProtocolLpFee(uint16 protocolLpFeeBps_) external onlyOwner {
        if (protocolLpFeeBps_ > MAX_PROTOCOL_LP_FEE_BPS) revert ConfigOutOfBounds();
        protocolLpFeeBps = protocolLpFeeBps_;
        emit ProtocolLpFeeUpdated(protocolLpFeeBps_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function poolKeyOf(address token) external view returns (V4PoolKey memory) {
        LaunchRecord memory launchRecord = launches[token];
        return _poolKey(token, launchRecord.quoteToken, launchRecord.fee, launchRecord.tickSpacing, launchRecord.hooks);
    }

    function _validate(LaunchParams calldata params) internal view {
        if (bytes(params.name).length == 0 || bytes(params.name).length > 64) revert InvalidName();
        if (bytes(params.symbol).length == 0 || bytes(params.symbol).length > 32) revert InvalidSymbol();
        if (bytes(params.metadataURI).length > 2048) revert InvalidMetadataURI();
        if (params.totalSupply < MIN_TOTAL_SUPPLY || params.totalSupply > MAX_TOTAL_SUPPLY) revert InvalidTotalSupply();
        if (params.quoteToken == address(0) || params.quoteToken.code.length == 0) revert InvalidQuoteToken();
        if (params.fee > MAX_POOL_FEE) revert InvalidPoolFee();
        if (params.tickSpacing <= 0) revert InvalidTickSpacing();

        int24 maxUsableTick = (TickMath.MAX_TICK / params.tickSpacing) * params.tickSpacing;
        if (params.initialTick % params.tickSpacing != 0) revert TickNotAligned();
        if (params.initialTick <= -maxUsableTick || params.initialTick >= maxUsableTick) revert TickOutOfRange();

        uint256 count = params.positions.length;
        if (count > MAX_POSITIONS) revert InvalidPositions();
        uint256 bpsSum = 0;
        for (uint256 i = 0; i < count; i++) {
            LiquidityPosition calldata p = params.positions[i];
            if (p.tickLower % params.tickSpacing != 0 || p.tickUpper % params.tickSpacing != 0) revert TickNotAligned();
            if (p.tickLower < params.initialTick || p.tickUpper <= p.tickLower || p.tickUpper > maxUsableTick) {
                revert InvalidPositions();
            }
            if (p.bps == 0) revert InvalidBps();
            bpsSum += p.bps;
        }
        if (count > 0 && bpsSum != BPS_DENOMINATOR) revert InvalidBps();
    }

    function _collectLaunchFee(LaunchParams calldata params) internal returns (uint256 nativeInitialBuyWei) {
        uint256 fee_ = launchFeeWei;
        if (fee_ > params.maxLaunchFeeWei) revert LaunchFeeAboveCap(fee_, params.maxLaunchFeeWei);
        uint256 expectedValue = fee_;
        if (
            params.initialBuyQuoteAmount > 0 && params.quoteToken == wrappedNative
                && msg.value == fee_ + params.initialBuyQuoteAmount
        ) {
            nativeInitialBuyWei = params.initialBuyQuoteAmount;
            expectedValue += params.initialBuyQuoteAmount;
        }
        if (msg.value != expectedValue) revert IncorrectNativeValue();
        if (fee_ > 0) {
            (bool ok,) = treasury.call{value: fee_}("");
            if (!ok) revert NativeTransferFailed();
        }
    }

    function _deployToken(LaunchParams calldata params) internal returns (address) {
        EagleToken token = new EagleToken{salt: keccak256(abi.encode(msg.sender, params.salt))}(
            params.name, params.symbol, params.totalSupply, address(this), params.metadataURI, msg.sender
        );
        return address(token);
    }

    function _mintLockedPositions(address token, V4PoolKey memory poolKey, LaunchParams calldata params)
        internal
        returns (uint256[] memory positionIds)
    {
        if (params.totalSupply > type(uint160).max) revert AmountTooLarge();
        address permit2 = positionManager.permit2();
        IERC20(token).forceApprove(permit2, params.totalSupply);
        IPermit2AllowanceTransfer(permit2).approve(
            token, address(positionManager), uint160(params.totalSupply), type(uint48).max
        );

        uint256 count = params.positions.length == 0 ? 1 : params.positions.length;
        positionIds = new uint256[](count);
        uint256 remaining = params.totalSupply;
        address creatorRecipient = params.creatorFeeRecipient == address(0) ? msg.sender : params.creatorFeeRecipient;

        for (uint256 i = 0; i < count; i++) {
            (int24 lower, int24 upper, uint256 amount) = _positionSlice(params, i, count, remaining);
            remaining -= amount;

            bool tokenIsCurrency0 = token < params.quoteToken;
            (int24 mintLower, int24 mintUpper) = tokenIsCurrency0 ? (lower, upper) : (-upper, -lower);
            uint256 liquidity = tokenIsCurrency0
                ? _getLiquidityForAmount0(mintLower, mintUpper, amount)
                : _getLiquidityForAmount1(mintLower, mintUpper, amount);
            if (amount > type(uint128).max) revert AmountTooLarge();

            bytes memory actions = abi.encodePacked(RobinhoodV4Actions.MINT_POSITION, RobinhoodV4Actions.SETTLE_PAIR);
            bytes[] memory actionParams = new bytes[](2);
            uint256 tokenId = positionManager.nextTokenId();
            actionParams[0] = abi.encode(
                poolKey,
                mintLower,
                mintUpper,
                liquidity,
                uint128(tokenIsCurrency0 ? amount : 0),
                uint128(tokenIsCurrency0 ? 0 : amount),
                address(locker),
                bytes("")
            );
            actionParams[1] = abi.encode(poolKey.currency0, poolKey.currency1);
            positionManager.modifyLiquidities(abi.encode(actions, actionParams), block.timestamp);

            if (positionManager.ownerOf(tokenId) != address(locker)) revert PositionMintFailed();
            positionIds[i] = tokenId;
            locker.assignPosition(tokenId, token, params.quoteToken, creatorRecipient, protocolLpFeeBps);
        }

        IPermit2AllowanceTransfer(permit2).approve(token, address(positionManager), 0, 0);
        IERC20(token).forceApprove(permit2, 0);
        uint256 dust = IERC20(token).balanceOf(address(this));
        if (dust > 0) IERC20(token).safeTransfer(DEAD, dust);
    }

    function _executeInitialBuy(address token, V4PoolKey memory poolKey, LaunchParams calldata params, uint256 nativeBuyWei)
        internal
    {
        uint256 amountIn = params.initialBuyQuoteAmount;
        if (amountIn == 0) return;
        if (amountIn > type(uint128).max) revert AmountTooLarge();

        address recipient = params.initialBuyRecipient == address(0) ? msg.sender : params.initialBuyRecipient;
        bool fundedNatively = nativeBuyWei > 0;
        uint256 initialQuoteBalance = IERC20(params.quoteToken).balanceOf(address(this));
        uint256 initialTokenBalance = IERC20(token).balanceOf(address(this));

        if (fundedNatively) {
            IWBNB(wrappedNative).deposit{value: nativeBuyWei}();
        } else {
            IERC20(params.quoteToken).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        address permit2 = positionManager.permit2();
        IERC20(params.quoteToken).forceApprove(permit2, amountIn);
        IPermit2AllowanceTransfer(permit2).approve(params.quoteToken, universalRouter, uint160(amountIn), type(uint48).max);

        bytes memory commands = abi.encodePacked(RobinhoodUniversalRouterCommands.V4_SWAP);
        bytes memory actions = abi.encodePacked(
            RobinhoodV4SwapActions.SWAP_EXACT_IN_SINGLE,
            RobinhoodV4SwapActions.SETTLE_ALL,
            RobinhoodV4SwapActions.TAKE_ALL
        );
        bytes[] memory actionParams = new bytes[](3);
        actionParams[0] = abi.encode(
            V4ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: params.quoteToken == poolKey.currency0,
                amountIn: uint128(amountIn),
                amountOutMinimum: uint128(params.initialBuyMinTokensOut),
                hookData: bytes("")
            })
        );
        actionParams[1] = abi.encode(params.quoteToken, amountIn);
        actionParams[2] = abi.encode(token, params.initialBuyMinTokensOut);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, actionParams);

        IUniversalRouter(universalRouter).execute(commands, inputs, block.timestamp + 20);

        IPermit2AllowanceTransfer(permit2).approve(params.quoteToken, universalRouter, 0, 0);
        IERC20(params.quoteToken).forceApprove(permit2, 0);

        uint256 tokensOut = IERC20(token).balanceOf(address(this)) - initialTokenBalance;
        if (tokensOut > 0) IERC20(token).safeTransfer(recipient, tokensOut);

        uint256 leftover = IERC20(params.quoteToken).balanceOf(address(this)) - initialQuoteBalance;
        if (leftover > 0) {
            if (fundedNatively) {
                IWBNB(wrappedNative).withdraw(leftover);
                (bool ok,) = msg.sender.call{value: leftover}("");
                if (!ok) revert NativeTransferFailed();
            } else {
                IERC20(params.quoteToken).safeTransfer(msg.sender, leftover);
            }
        }

        emit InitialBuyExecuted(token, recipient, amountIn - leftover, tokensOut);
    }

    function _positionSlice(LaunchParams calldata params, uint256 i, uint256 count, uint256 remaining)
        internal
        pure
        returns (int24 lower, int24 upper, uint256 amount)
    {
        if (params.positions.length == 0) {
            lower = params.initialTick;
            upper = (TickMath.MAX_TICK / params.tickSpacing) * params.tickSpacing;
            amount = remaining;
        } else {
            LiquidityPosition calldata p = params.positions[i];
            lower = p.tickLower;
            upper = p.tickUpper;
            amount = i == count - 1 ? remaining : (params.totalSupply * p.bps) / BPS_DENOMINATOR;
        }
    }

    function _poolKey(address token, address quoteToken, uint24 fee, int24 tickSpacing, address hooks)
        internal
        pure
        returns (V4PoolKey memory)
    {
        return token < quoteToken
            ? V4PoolKey({currency0: token, currency1: quoteToken, fee: fee, tickSpacing: tickSpacing, hooks: hooks})
            : V4PoolKey({currency0: quoteToken, currency1: token, fee: fee, tickSpacing: tickSpacing, hooks: hooks});
    }

    function _poolTick(address token, address quoteToken, int24 initialTick) internal pure returns (int24) {
        return token < quoteToken ? initialTick : -initialTick;
    }

    function _poolId(V4PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks));
    }

    function _getLiquidityForAmount0(int24 tickLower, int24 tickUpper, uint256 amount0)
        internal
        pure
        returns (uint256)
    {
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
        if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        uint256 intermediate = FullMath.mulDiv(uint256(sqrtRatioAX96), uint256(sqrtRatioBX96), Q96);
        return FullMath.mulDiv(amount0, intermediate, uint256(sqrtRatioBX96) - uint256(sqrtRatioAX96));
    }

    function _getLiquidityForAmount1(int24 tickLower, int24 tickUpper, uint256 amount1)
        internal
        pure
        returns (uint256)
    {
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
        if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        return FullMath.mulDiv(amount1, Q96, uint256(sqrtRatioBX96) - uint256(sqrtRatioAX96));
    }

    /// @dev Accepts native ETH only while unwrapping WETH refunds.
    receive() external payable {
        if (msg.sender != wrappedNative) revert IncorrectNativeValue();
    }
}

contract ZeroHolderDistributor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant EAGLE = "launch on eagle.family";

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public immutable token;
    address public immutable quoteToken;
    uint24 public immutable fee;
    int24 public immutable tickSpacing;
    address public immutable hooks;
    address public immutable universalRouter;
    ZeroLiquidityLocker public immutable locker;
    IUniswapV4PositionManager public immutable positionManager;

    event DistributedToHolders(address indexed caller, uint256 quoteSpent, uint256 tokensBurned);

    error UnknownLaunch();
    error NothingToDistribute();
    error SlippageExceeded(uint256 burned, uint256 minimum);
    error AmountTooLarge();

    constructor(ZeroFactory brewFactory_, address token_) {
        (, address quoteToken_,, uint24 fee_, int24 tickSpacing_, address hooks_,, uint64 launchedAtBlock) =
            brewFactory_.launches(token_);
        if (launchedAtBlock == 0) revert UnknownLaunch();
        token = token_;
        quoteToken = quoteToken_;
        fee = fee_;
        tickSpacing = tickSpacing_;
        hooks = hooks_;
        universalRouter = brewFactory_.universalRouter();
        locker = brewFactory_.locker();
        positionManager = brewFactory_.positionManager();
    }

    function distribute(uint256 minTokensOut)
        external
        nonReentrant
        returns (uint256 quoteSpent, uint256 tokensBurned)
    {
        uint256 deadBalanceBefore = IERC20(token).balanceOf(DEAD);
        locker.collectAllFees(token);
        if (locker.claimableFees(address(this), token) > 0) {
            locker.claimFees(token, DEAD);
        }
        if (locker.claimableFees(address(this), quoteToken) > 0) {
            locker.claimFees(quoteToken, address(this));
        }

        uint256 quoteBalance = IERC20(quoteToken).balanceOf(address(this));
        uint256 burnedDirect = IERC20(token).balanceOf(DEAD) - deadBalanceBefore;
        if (quoteBalance == 0) {
            if (burnedDirect == 0) revert NothingToDistribute();
            if (burnedDirect < minTokensOut) revert SlippageExceeded(burnedDirect, minTokensOut);
            emit DistributedToHolders(msg.sender, 0, burnedDirect);
            return (0, burnedDirect);
        }
        if (quoteBalance > type(uint128).max) revert AmountTooLarge();

        uint256 swapMinTokensOut = burnedDirect >= minTokensOut ? 0 : minTokensOut - burnedDirect;
        if (swapMinTokensOut > type(uint128).max) revert AmountTooLarge();

        address permit2 = positionManager.permit2();
        IERC20(quoteToken).forceApprove(permit2, quoteBalance);
        IPermit2AllowanceTransfer(permit2).approve(quoteToken, universalRouter, uint160(quoteBalance), type(uint48).max);

        V4PoolKey memory poolKey = token < quoteToken
            ? V4PoolKey({currency0: token, currency1: quoteToken, fee: fee, tickSpacing: tickSpacing, hooks: hooks})
            : V4PoolKey({currency0: quoteToken, currency1: token, fee: fee, tickSpacing: tickSpacing, hooks: hooks});
        bytes memory commands = abi.encodePacked(RobinhoodUniversalRouterCommands.V4_SWAP);
        bytes memory actions = abi.encodePacked(
            RobinhoodV4SwapActions.SWAP_EXACT_IN_SINGLE,
            RobinhoodV4SwapActions.SETTLE_ALL,
            RobinhoodV4SwapActions.TAKE_ALL
        );
        bytes[] memory actionParams = new bytes[](3);
        actionParams[0] = abi.encode(
            V4ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: quoteToken == poolKey.currency0,
                amountIn: uint128(quoteBalance),
                amountOutMinimum: uint128(swapMinTokensOut),
                hookData: bytes("")
            })
        );
        actionParams[1] = abi.encode(quoteToken, quoteBalance);
        actionParams[2] = abi.encode(token, uint256(0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, actionParams);

        IUniversalRouter(universalRouter).execute(commands, inputs, block.timestamp + 20);

        IPermit2AllowanceTransfer(permit2).approve(quoteToken, universalRouter, 0, 0);
        IERC20(quoteToken).forceApprove(permit2, 0);

        uint256 leftover = IERC20(quoteToken).balanceOf(address(this));
        if (leftover > 0) {
            IERC20(quoteToken).safeTransfer(msg.sender, leftover);
        }

        quoteSpent = quoteBalance - leftover;
        tokensBurned = IERC20(token).balanceOf(DEAD) - deadBalanceBefore;
        if (tokensBurned < minTokensOut) revert SlippageExceeded(tokensBurned, minTokensOut);
        emit DistributedToHolders(msg.sender, quoteSpent, tokensBurned);
    }
}

contract ZeroDistributorFactory {
    string public constant EAGLE = "launch on eagle.family";

    ZeroFactory public immutable brewFactory;

    mapping(address token => address distributor) public distributorOf;

    event DistributorCreated(address indexed token, address indexed distributor);

    constructor(ZeroFactory brewFactory_) {
        brewFactory = brewFactory_;
    }

    function create(address token) public returns (address distributor) {
        distributor = distributorOf[token];
        if (distributor != address(0)) return distributor;
        distributor = address(
            new ZeroHolderDistributor{salt: bytes32(uint256(uint160(token)))}(brewFactory, token)
        );
        distributorOf[token] = distributor;
        emit DistributorCreated(token, distributor);
    }

    function distribute(address token, uint256 minTokensOut)
        external
        returns (uint256 quoteSpent, uint256 tokensBurned)
    {
        return ZeroHolderDistributor(create(token)).distribute(minTokensOut);
    }

    function predict(address token) external view returns (address) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(ZeroHolderDistributor).creationCode, abi.encode(brewFactory, token))
        );
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff), address(this), bytes32(uint256(uint160(token))), initCodeHash
                        )
                    )
                )
            )
        );
    }
}
