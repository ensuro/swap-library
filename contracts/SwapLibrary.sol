// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {WadRayMath} from "./dependencies/WadRayMath.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title Swap Library
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
library SwapLibrary {
  using WadRayMath for uint256;

  /**
   * @dev Enum with the different protocols
   */
  enum SwapProtocol {
    undefined,
    uniswap
  }

  struct SwapConfig {
    SwapProtocol protocol;
    uint256 maxSlippage;
    bytes customParams;
  }

  struct UniswapCustomParams {
    uint24 feeTier;
    ISwapRouter router;
  }

  function validate(SwapConfig calldata swapConfig) external pure {
    require(swapConfig.maxSlippage > 0, "SwapLibrary: maxSlippage cannot be zero");
    if (swapConfig.protocol == SwapProtocol.uniswap) {
      UniswapCustomParams memory cp = abi.decode(swapConfig.customParams, (UniswapCustomParams));
      require(address(cp.router) != address(0), "SwapLibrary: SwapRouter address cannot be zero");
      require(cp.feeTier > 0, "SwapLibrary: feeTier cannot be zero");
    } else revert("SwapLibrary: invalid protocol");
  }

  function _toWadFactor(address token) internal view returns (uint256) {
    return (10 ** (18 - IERC20Metadata(token).decimals()));
  }

  /**
   * @dev Executes a swap of `amount` from the input token (`tokenIn`) to the output token (`tokenOut`),
   * @param swapConfig Swap configuration including the swap protocol to use.
   * @param tokenIn The address of the token to be swapped.
   * @param tokenOut The address of the token to be received as a result of the swap.
   * @param amount The exact amount of input token to be swapped.
   * @param price Approximate amount of units of tokenIn required to acquire a unit of tokenOut.
   *              It will be validated against the swap rate considering the maxSlippage.
   *
   * @notice Should have at least `amount` of tokenIn in the contract to execute the transaction.
   *
   * Requirements:
   * - tokenIn and tokenOut decimals <= 18
   * - SwapConfig must be valid and should be validated using the `validate()` method.
   *
   * @return That exact `amount` went out and an tokenOut amount equal to amount/price +- slippage% came in.
   */
  function exactInput(
    SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) external returns (uint256) {
    if (swapConfig.protocol == SwapProtocol.uniswap) {
      return _exactInputUniswap(swapConfig, tokenIn, tokenOut, amount, price);
    }
    return 0;
  }

  /**
   * @dev Executes a swap, where the desired output amount of `tokenOut` is specified,
   * @param swapConfig Swap configuration including the protocol to use for the swap.
   * @param tokenIn The address of the token to be used as input for the swap.
   * @param tokenOut The address of the token to be received as a result of the swap.
   * @param amount The desired amount of output tokens (`tokenOut`) to be obtained from the swap.
   * @param price Approximate amount of units of tokenIn required to acquire a unit of tokenOut.
   *              It will be validated against the swap rate considering the maxSlippage.
   *
   * @notice Should have sufficient `tokenIn` to fulfill the desired output amount.
   *
   * Requirements:
   * - tokenIn and tokenOut decimals <= 18
   * - SwapConfig must be valid and should be validated using the `validate()` method.
   *
   * @return The actual amount of input tokens (`tokenIn`) spent to obtain the desired output amount (`amount`)
   *   should be within the expected slippage range.
   */
  function exactOutput(
    SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) external returns (uint256) {
    if (swapConfig.protocol == SwapProtocol.uniswap) {
      return _exactOutputUniswap(swapConfig, tokenIn, tokenOut, amount, price);
    }
    return 0;
  }

  function _exactInputUniswap(
    SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) internal returns (uint256) {
    UniswapCustomParams memory cp = abi.decode(swapConfig.customParams, (UniswapCustomParams));
    uint256 amountInMin = (amount * _toWadFactor(tokenIn)).wadDiv(price).wadMul(
      WadRayMath.WAD - swapConfig.maxSlippage
    ) / _toWadFactor(tokenOut);

    IERC20Metadata(tokenIn).approve(address(cp.router), amount);
    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: cp.feeTier,
      recipient: address(this),
      deadline: block.timestamp,
      amountIn: amount,
      amountOutMinimum: amountInMin,
      sqrtPriceLimitX96: 0 // Since we're limiting the transfer amount, we don't need to worry about the price impact of the transaction
    });

    uint256 received = cp.router.exactInputSingle(params);

    require(
      IERC20Metadata(tokenIn).allowance(address(this), address(cp.router)) == 0,
      "SwapLibrary: something wrong, allowance should go back to 0"
    );
    // Sanity check
    require(received >= amountInMin, "SwapLibrary: slippage greater than maxSlippage");
    return received;
  }

  function _exactOutputUniswap(
    SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) internal returns (uint256) {
    UniswapCustomParams memory cp = abi.decode(swapConfig.customParams, (UniswapCustomParams));

    uint256 amountInMax = (amount * _toWadFactor(tokenOut)).wadMul(price).wadMul(
      WadRayMath.WAD + swapConfig.maxSlippage
    ) / _toWadFactor(tokenIn);

    IERC20Metadata(tokenIn).approve(address(cp.router), type(uint256).max);
    ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: cp.feeTier,
      recipient: address(this),
      deadline: block.timestamp,
      amountOut: amount,
      amountInMaximum: amountInMax,
      sqrtPriceLimitX96: 0 // Since we're limiting the transfer amount, we don't need to worry about the price impact of the transaction
    });
    uint256 actualAmount = cp.router.exactOutputSingle(params);

    IERC20Metadata(tokenIn).approve(address(cp.router), 0);
    // Sanity check
    require(actualAmount <= amountInMax, "SwapLibrary: exchange rate higher than tolerable");
    return actualAmount;
  }
}
