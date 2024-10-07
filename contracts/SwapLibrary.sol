// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {WadRayMath} from "./dependencies/WadRayMath.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {ICurveRouter} from "./dependencies/ICurveRouter.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CurveRoutes} from "./CurveRoutes.sol";

/**
 * @title Swap Library
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
library SwapLibrary {
  using WadRayMath for uint256;

  // Limit on the number of exchanges done by the exactOutput curve workaround
  uint256 internal constant MAX_EXCHANGE = 2;

  /**
   * @dev Enum with the different protocols
   */
  enum SwapProtocol {
    undefined,
    uniswap,
    curveRouter
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

  error InvalidProtocol();
  error MaxSlippageCannotBeZero();
  error UniswapRouterCannotBeZero();
  error UniswapFeeTierCannotBeZero();
  error AllowanceShouldGoBackToZero();
  error ReceivedLessThanAcceptable(uint256 received, uint256 amountOutMin);
  error SpentMoreThanAcceptable(uint256 spent, uint256 amountInMax);

  function validate(SwapConfig calldata swapConfig) external pure {
    if (swapConfig.maxSlippage == 0) revert MaxSlippageCannotBeZero();
    if (swapConfig.protocol == SwapProtocol.uniswap) {
      UniswapCustomParams memory cp = abi.decode(swapConfig.customParams, (UniswapCustomParams));
      if (address(cp.router) == address(0)) revert UniswapRouterCannotBeZero();
      if (cp.feeTier == 0) revert UniswapFeeTierCannotBeZero();
    } else if (swapConfig.protocol == SwapProtocol.curveRouter) {
      CurveRoutes.validate(swapConfig.customParams);
    } else revert InvalidProtocol();
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
    } else if (swapConfig.protocol == SwapProtocol.curveRouter) {
      return _exactInputCurve(swapConfig, tokenIn, tokenOut, amount, price);
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
    } else if (swapConfig.protocol == SwapProtocol.curveRouter) {
      return _exactOutputCurve(swapConfig, tokenIn, tokenOut, amount, price);
    }
    return 0;
  }

  function _calcMinAmount(
    uint256 amount,
    uint256 maxSlippage,
    address tokenIn,
    address tokenOut,
    uint256 price
  ) internal view returns (uint256) {
    return (amount * _toWadFactor(tokenIn)).wadDiv(price).wadMul(WadRayMath.WAD - maxSlippage) / _toWadFactor(tokenOut);
  }

  function _calcMaxAmount(
    uint256 amount,
    uint256 maxSlippage,
    address tokenIn,
    address tokenOut,
    uint256 price
  ) internal view returns (uint256) {
    return (amount * _toWadFactor(tokenOut)).wadMul(price).wadMul(WadRayMath.WAD + maxSlippage) / _toWadFactor(tokenIn);
  }

  function _exactInputUniswap(
    SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) internal returns (uint256) {
    UniswapCustomParams memory cp = abi.decode(swapConfig.customParams, (UniswapCustomParams));
    uint256 amountOutMin = _calcMinAmount(amount, swapConfig.maxSlippage, tokenIn, tokenOut, price);

    IERC20Metadata(tokenIn).approve(address(cp.router), amount);
    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: cp.feeTier,
      recipient: address(this),
      deadline: block.timestamp,
      amountIn: amount,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0 // Since we're limiting the transfer amount, we don't need to worry about the price impact of the transaction
    });

    uint256 received = cp.router.exactInputSingle(params);
    if (IERC20Metadata(tokenIn).allowance(address(this), address(cp.router)) != 0) revert AllowanceShouldGoBackToZero();
    // Sanity check
    if (received < amountOutMin) revert ReceivedLessThanAcceptable(received, amountOutMin);
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

    uint256 amountInMax = _calcMaxAmount(amount, swapConfig.maxSlippage, tokenIn, tokenOut, price);

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
    if (actualAmount > amountInMax) revert SpentMoreThanAcceptable(actualAmount, amountInMax);
    return actualAmount;
  }

  function _exactInputCurve(
    SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) internal returns (uint256 received) {
    (ICurveRouter router, CurveRoutes.CurveRoute memory route) = CurveRoutes.findRoute(
      swapConfig.customParams,
      tokenIn,
      tokenOut
    );
    uint256 amountOutMin = _calcMinAmount(amount, swapConfig.maxSlippage, tokenIn, tokenOut, price);

    IERC20Metadata(tokenIn).approve(address(router), amount);
    received = router.exchange(route.route, route.swapParams, amount, amountOutMin, route.pools, address(this));

    if (IERC20Metadata(tokenIn).allowance(address(this), address(router)) != 0) revert AllowanceShouldGoBackToZero();
    // Sanity check
    if (received < amountOutMin) revert ReceivedLessThanAcceptable(received, amountOutMin);
    return received;
  }

  function _exchangeCurve(
    ICurveRouter router,
    CurveRoutes.CurveRoute memory route,
    uint256 amount
  ) internal returns (uint256 received, uint256 amountInActual) {
    amountInActual = router.get_dx(route.route, route.swapParams, amount, route.pools);
    received = router.exchange(
      route.route,
      route.swapParams,
      amountInActual,
      0, // I don't verify here, but anyway the token approval defines the limit
      route.pools,
      address(this)
    );
  }

  function _exactOutputCurve(
    SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) internal returns (uint256) {
    (ICurveRouter router, CurveRoutes.CurveRoute memory route) = CurveRoutes.findRoute(
      swapConfig.customParams,
      tokenIn,
      tokenOut
    );
    uint256 amountInMax = _calcMaxAmount(amount, swapConfig.maxSlippage, tokenIn, tokenOut, price);
    IERC20Metadata(tokenIn).approve(address(router), amountInMax);
    uint256 amountInConsumed = 0;

    // Workaround because get_dx isn't reliable - Does up to MAX_EXCHANGE to aproximate as much as possible
    for (uint256 i; amount != 0 && i < MAX_EXCHANGE; i++) {
      (uint256 received, uint256 amountInActual) = _exchangeCurve(router, route, amount);
      amount -= Math.min(amount, received);
      amountInConsumed += amountInActual;
    }
    IERC20Metadata(tokenIn).approve(address(router), 0);
    return amountInConsumed;
  }
}
