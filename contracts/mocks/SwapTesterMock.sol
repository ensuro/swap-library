// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {SwapLibrary} from "./../SwapLibrary.sol";

contract SwapTesterMock {
  using SwapLibrary for SwapLibrary.SwapConfig;

  event ExactInputResult(uint256 input);
  event ExactOutputResult(uint256 output);

  function executeExactInput(
    SwapLibrary.SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) external virtual {
    swapConfig.validate();
    uint256 ret = swapConfig.exactInput(tokenIn, tokenOut, amount, price);
    emit ExactInputResult(ret);
  }

  function executeExactOutput(
    SwapLibrary.SwapConfig calldata swapConfig,
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 price
  ) external virtual {
    swapConfig.validate();
    uint256 ret = swapConfig.exactOutput(tokenIn, tokenOut, amount, price);
    emit ExactOutputResult(ret);
  }
}
