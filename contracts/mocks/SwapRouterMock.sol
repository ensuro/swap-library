// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ISwapRouterErrors} from "../interfaces/ISwapRouterErrors.sol";

/**
 * @title SwapRouterMock
 * @notice SwapRouter mock that can swap a single type of token for several others
 */
contract SwapRouterMock is ISwapRouterErrors {
  using SafeERC20 for IERC20Metadata;
  using Math for uint256;
  using SafeCast for uint256;

  uint256 internal constant WAD = 1e18;

  error AdminCannotBeZero();
  event PriceUpdated(address tokenIn, address tokenOut, uint256 price);
  error NotEnoughBalance(uint256 available, uint256 required);

  mapping(address => mapping(address => uint256)) private _prices;

  constructor(address admin) {
    if (admin == address(0)) revert AdminCannotBeZero();
  }

  function _toWadFactor(address token) internal view returns (uint256) {
    return (10 ** (18 - IERC20Metadata(token).decimals()));
  }

  /**
   * @inheritdoc ISwapRouter
   */
  function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
    require(params.recipient != address(0), RecipientCannotBeZero());
    require(params.deadline >= block.timestamp, DeadlineInThePast());
    require(params.amountIn > 0, AmountCannotBeZero());

    uint256 amountOutInWad = (params.amountIn * _toWadFactor(params.tokenIn)).mulDiv(
      WAD,
      _prices[params.tokenIn][params.tokenOut]
    );
    amountOut = amountOutInWad / _toWadFactor(params.tokenOut);
    require(amountOut >= params.amountOutMinimum, OutputAmountLessThanSlippage(amountOut, params.amountOutMinimum));

    IERC20Metadata(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
    IERC20Metadata(params.tokenOut).safeTransfer(params.recipient, amountOut);
  }

  /**
   * @inheritdoc ISwapRouter
   */
  function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn) {
    require(params.recipient != address(0), RecipientCannotBeZero());
    require(params.deadline >= block.timestamp, DeadlineInThePast());
    require(params.amountOut > 0, AmountCannotBeZero());
    uint256 balance = IERC20Metadata(params.tokenOut).balanceOf(address(this));
    require(
      IERC20Metadata(params.tokenOut).balanceOf(address(this)) >= params.amountOut,
      NotEnoughBalance(balance, params.amountOut)
    );

    uint256 amountInWad = (params.amountOut * _toWadFactor(params.tokenOut)).mulDiv(
      _prices[params.tokenIn][params.tokenOut],
      WAD
    );
    amountIn = amountInWad / _toWadFactor(params.tokenIn);
    require(amountIn <= params.amountInMaximum, InputAmountExceedsSlippage(amountIn, params.amountInMaximum));

    IERC20Metadata(params.tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
    IERC20Metadata(params.tokenOut).safeTransfer(params.recipient, params.amountOut);
  }

  function withdraw(address token, uint256 amount) external {
    require(token != address(0), TokenCannotBeZero());
    require(amount > 0, TokenCannotBeZero());
    IERC20Metadata(token).safeTransfer(msg.sender, amount);
  }

  function setCurrentPrice(address tokenIn, address tokenOut, uint256 price_) external {
    require(tokenIn != address(0), TokenCannotBeZero());
    require(tokenOut != address(0), TokenCannotBeZero());
    _prices[tokenIn][tokenOut] = price_;
    emit PriceUpdated(tokenIn, tokenOut, price_);
  }

  /**
   * @inheritdoc ISwapRouter
   * @notice This function is not implemented
   */
  function exactOutput(ExactOutputParams calldata) external payable returns (uint256) {
    revert NotImplemented();
  }

  /**
   * @inheritdoc ISwapRouter
   * @notice This function is not implemented
   */
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
