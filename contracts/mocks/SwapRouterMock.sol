// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {WadRayMath} from "../dependencies/WadRayMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title SwapRouterMock
 * @notice SwapRouter mock that can swap a single type of token for several others
 */
contract SwapRouterMock is ISwapRouter {
  using SafeERC20 for IERC20Metadata;
  using WadRayMath for uint256;
  using SafeCast for uint256;

  /**
   * @dev Only one token in is allowed for swaps
   */
  IERC20Metadata internal immutable _tokenIn;
  uint256 internal immutable _wadToTokenInFactor;

  event PriceUpdated(uint256 price);

  uint256 internal _price;

  constructor(address admin, IERC20Metadata tokenIn_) {
    require(admin != address(0), "Admin cannot be zero address");
    require(address(tokenIn_) != address(0), "TokenIn cannot be zero address");

    _tokenIn = tokenIn_;
    _wadToTokenInFactor = (10 ** (18 - _tokenIn.decimals()));
  }

  /**
   * @inheritdoc ISwapRouter
   */
  function exactInputSingle(
    ExactInputSingleParams calldata params
  ) external payable returns (uint256 amountOut) {
    require(params.tokenIn == address(_tokenIn), "TokenIn not supported");
    // require(address(_oracles[params.tokenOut]) != address(0), "TokenOut not supported");
    require(params.recipient != address(0), "Recipient cannot be zero address");
    require(params.deadline >= block.timestamp, "Deadline in the past");
    require(params.amountIn > 0, "amountIn cannot be zero");

    amountOut = (params.amountIn * _wadToTokenInFactor).wadDiv(_price);
    require(amountOut >= params.amountOutMinimum, "amountOutMinimum not reached");

    _tokenIn.safeTransferFrom(msg.sender, address(this), params.amountIn);
    IERC20Metadata(params.tokenOut).safeTransfer(params.recipient, amountOut);
  }

  /**
   * @inheritdoc ISwapRouter
   */
  function exactOutputSingle(
    ExactOutputSingleParams calldata params
  ) external payable returns (uint256 amountIn) {
    require(params.tokenIn == address(_tokenIn), "TokenIn not supported");
    // require(address(_oracles[params.tokenOut]) != address(0), "TokenOut not supported");
    require(params.recipient != address(0), "Recipient cannot be zero address");
    require(params.deadline >= block.timestamp, "Deadline in the past");
    require(params.amountOut > 0, "AmountOut cannot be zero");
    require(
      IERC20Metadata(params.tokenOut).balanceOf(address(this)) >= params.amountOut,
      "Not enough balance"
    );

    uint256 amountInWad = params.amountOut.wadMul(_price);
    amountIn = amountInWad / _wadToTokenInFactor;

    require(amountIn <= params.amountInMaximum, "amountInMaximum exceeded");

    _tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
    IERC20Metadata(params.tokenOut).safeTransfer(params.recipient, params.amountOut);
  }

  function withdraw(address token, uint256 amount) external {
    require(token != address(0), "Token cannot be zero address");
    require(amount > 0, "Amount cannot be zero");
    IERC20Metadata(token).safeTransfer(msg.sender, amount);
  }

  function setCurrentPrice(uint256 price_) external {
    _price = price_;
    emit PriceUpdated(price_);
  }

  function tokenIn() external view returns (IERC20Metadata) {
    return _tokenIn;
  }

  /**
   * @inheritdoc ISwapRouter
   * @notice This function is not implemented
   */
  function exactOutput(ExactOutputParams calldata) external payable returns (uint256) {
    revert("Not implemented");
  }

  /**
   * @inheritdoc ISwapRouter
   * @notice This function is not implemented
   */
  function exactInput(ExactInputParams calldata) external payable returns (uint256) {
    revert("Not implemented");
  }

  /**
   * @notice This function is not implemented
   */
  function uniswapV3SwapCallback(int256, int256, bytes calldata) external pure {
    revert("Not implemented");
  }
}
