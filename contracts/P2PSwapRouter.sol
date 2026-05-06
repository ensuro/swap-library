// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ISwapRouterErrors} from "./interfaces/ISwapRouterErrors.sol";

/**
 * @title P2PSwapRouter
 * @notice Contract following the interface of ISwapRouter that executes single swaps from authorized contracts
 *         at configured prices, on behalf of an account
 */
contract P2PSwapRouter is ISwapRouterErrors {
  using SafeERC20 for IERC20Metadata;
  using Math for uint256;
  using SafeCast for uint256;

  uint256 internal constant WAD = 1e18;

  struct Price {
    address tokenIn;
    address tokenOut;
    uint256 price;
  }

  mapping(address tokenIn => mapping(address tokenOut => uint256 price)) internal _prices;
  address public immutable onBehalfOf;
  address public immutable swapper;
  address public immutable pricer;

  event PriceUpdated(address indexed tokenIn, address indexed tokenOut, uint256 price);
  error OnlySwapperCanSwap(address caller);
  error OnlyPricerCanChangePrice(address caller);

  constructor(address onBehalfOf_, address swapper_, address pricer_, Price[] memory initialPrices) {
    swapper = swapper_;
    pricer = pricer_;
    onBehalfOf = onBehalfOf_;
    for (uint256 i; i < initialPrices.length; ++i) {
      Price memory p = initialPrices[i];
      _setCurrentPrice(p.tokenIn, p.tokenOut, p.price);
    }
  }

  function _toWadFactor(address token) internal view returns (uint256) {
    return (10 ** (18 - IERC20Metadata(token).decimals()));
  }

  function _checkCallerIsSwapper() internal view {
    require(msg.sender == swapper, OnlySwapperCanSwap(msg.sender));
  }

  function _checkCallerIsPricer() internal view {
    require(msg.sender == pricer, OnlyPricerCanChangePrice(msg.sender));
  }

  function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
    _checkCallerIsSwapper();
    require(params.recipient != address(0), RecipientCannotBeZero());
    require(params.deadline >= block.timestamp, DeadlineInThePast());
    require(params.amountIn > 0, AmountCannotBeZero());

    uint256 amountOutInWad = (params.amountIn * _toWadFactor(params.tokenIn)).mulDiv(
      WAD,
      _prices[params.tokenIn][params.tokenOut]
    );
    amountOut = amountOutInWad / _toWadFactor(params.tokenOut);
    require(amountOut >= params.amountOutMinimum, OutputAmountLessThanSlippage(amountOut, params.amountOutMinimum));

    IERC20Metadata(params.tokenIn).safeTransferFrom(msg.sender, onBehalfOf, params.amountIn);
    IERC20Metadata(params.tokenOut).safeTransferFrom(onBehalfOf, params.recipient, amountOut);
  }

  function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn) {
    _checkCallerIsSwapper();
    require(params.recipient != address(0), RecipientCannotBeZero());
    require(params.deadline >= block.timestamp, DeadlineInThePast());
    require(params.amountOut > 0, AmountCannotBeZero());

    uint256 amountInWad = (params.amountOut * _toWadFactor(params.tokenOut)).mulDiv(
      _prices[params.tokenIn][params.tokenOut],
      WAD
    );
    amountIn = amountInWad / _toWadFactor(params.tokenIn);
    require(amountIn <= params.amountInMaximum, InputAmountExceedsSlippage(amountIn, params.amountInMaximum));

    IERC20Metadata(params.tokenIn).safeTransferFrom(msg.sender, onBehalfOf, amountIn);
    IERC20Metadata(params.tokenOut).safeTransferFrom(onBehalfOf, params.recipient, params.amountOut);
  }

  function setCurrentPrice(address tokenIn, address tokenOut, uint256 price_) external {
    _checkCallerIsPricer();
    _setCurrentPrice(tokenIn, tokenOut, price_);
  }

  function _setCurrentPrice(address tokenIn, address tokenOut, uint256 price_) internal {
    require(tokenIn != address(0), TokenCannotBeZero());
    require(tokenOut != address(0), TokenCannotBeZero());
    _prices[tokenIn][tokenOut] = price_;
    emit PriceUpdated(tokenIn, tokenOut, price_);
  }

  function getCurrentPrice(address tokenIn, address tokenOut) external view returns (uint256) {
    return _prices[tokenIn][tokenOut];
  }

  function exactOutput(ExactOutputParams calldata) external payable returns (uint256) {
    revert NotImplemented();
  }

  function exactInput(ExactInputParams calldata) external payable returns (uint256) {
    revert NotImplemented();
  }

  /**
   * @notice This function is not implemented
   */
  function uniswapV3SwapCallback(int256, int256, bytes calldata) external pure {
    revert NotImplemented();
  }
}
