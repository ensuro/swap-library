// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/**
 * @title ISwapRouterErrors
 *
 */
interface ISwapRouterErrors is ISwapRouter {
  error OutputAmountLessThanSlippage(uint256 amountOut, uint256 amountOutMinimum);
  error InputAmountExceedsSlippage(uint256 amountIn, uint256 amountInMaximum);
  error DeadlineInThePast();
  error AmountCannotBeZero();
  error TokenCannotBeZero();
  error RecipientCannotBeZero();
  error NotImplemented();
}
