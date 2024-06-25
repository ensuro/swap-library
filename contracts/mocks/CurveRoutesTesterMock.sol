// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {CurveRoutes} from "./../CurveRoutes.sol";
import {ICurveRouter} from "../dependencies/ICurveRouter.sol";

contract CurveRoutesTesterMock {
  function validate(bytes memory curveRoutes) external pure {
    CurveRoutes.validate(curveRoutes);
  }

  function readRoute(
    bytes memory curveRoutes,
    uint256 offset
  ) external pure returns (uint8 nSwaps, CurveRoutes.CurveRoute memory route) {
    return CurveRoutes.readRoute(curveRoutes, offset);
  }

  function routeSize(uint8 nSwaps) external pure returns (uint256) {
    return CurveRoutes.routeSize(nSwaps);
  }

  function findRoute(
    bytes memory curveRoutes,
    address tokenIn,
    address tokenOut
  ) external pure returns (ICurveRouter router, CurveRoutes.CurveRoute memory route) {
    return CurveRoutes.findRoute(curveRoutes, tokenIn, tokenOut);
  }
}
