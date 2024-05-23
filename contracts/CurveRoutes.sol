// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {ICurveRouter} from "./dependencies/ICurveRouter.sol";
import {BytesLib} from "solidity-bytes-utils/contracts/BytesLib.sol";

/**
 * @title Library to access a set of curve routes stored as tighly packed bytes
 *
 * @dev The format is a concatenation of bytes, packed (ethers.solidityPack in js) with the following fields
 *
 *      Fields:
 *      <ICurveRouter router>
 *      <uint8 numberOfRoutes>
 *      -- for each route --
 *      <uint8 numberOfSwaps>
 *      <address route[i] for i in range((numberOfSwaps * 2) + 1)
 *      <uint8 swapParam[i][j] for i in range(numberOfSwaps) for j in range(5)>
 *      <address pool[i] for in range(numberOfSwaps)
 *      -- end - for each route --
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
library CurveRoutes {
  using BytesLib for bytes;
  uint256 internal constant ADDRESS_SIZE = 4;
  uint256 internal constant UINT8_SIZE = 1;
  uint256 internal constant MAX_SWAPS = 5;

  struct CurveRoute {
    address[11] route;
    uint256[5][5] swapParams;
    address[5] pools;
  }

  error CurveRouterCantBeZero();
  error AtLeastOneRoute();
  error InvalidLength();
  error InvalidRoute(CurveRoute route);
  error TooManySwaps(uint8 nSwaps);
  error RouteNotFound(address tokenIn, address tokenOut);

  function validate(bytes memory curveRoutes) internal pure {
    ICurveRouter router = ICurveRouter(curveRoutes.toAddress(0));
    if (address(router) == address(0)) revert CurveRouterCantBeZero();
    uint8 nRoutes = curveRoutes.toUint8(ADDRESS_SIZE);
    if (nRoutes == 0) revert AtLeastOneRoute();
    uint256 offset = ADDRESS_SIZE + UINT8_SIZE;
    for (uint256 i; i < nRoutes; i++) {
      (uint8 nSwaps, CurveRoute memory route) = readRoute(curveRoutes, offset);
      for (uint256 j; j < nSwaps; j++) {
        if (route.route[j * 2] == address(0) || route.route[j * 2 + 1] == address(0))
          revert InvalidRoute(route);
      }
      if (route.route[nSwaps * 2] == address(0)) revert InvalidRoute(route);
      if (nSwaps != 5 && route.route[nSwaps * 2 + 1] != address(0)) revert InvalidRoute(route);
      offset += routeSize(nSwaps);
    }
    if (curveRoutes.length != offset) revert InvalidLength();
  }

  function readRoute(
    bytes memory curveRoutes,
    uint256 offset
  ) internal pure returns (uint8 nSwaps, CurveRoute memory route) {
    nSwaps = curveRoutes.toUint8(offset);
    if (nSwaps > MAX_SWAPS) revert TooManySwaps(nSwaps);
    for (uint256 i; i < (nSwaps * 2 + 1); i++) {
      route.route[i] = curveRoutes.toAddress(offset + 1 + i * ADDRESS_SIZE);
    }
    offset += 1 + (nSwaps * 2 + 1) * ADDRESS_SIZE;
    for (uint256 i; i < nSwaps; i++) {
      route.swapParams[i][0] = curveRoutes.toUint8(offset + i);
      route.swapParams[i][1] = curveRoutes.toUint8(offset + i + 1);
      route.swapParams[i][2] = curveRoutes.toUint8(offset + i + 2);
      route.swapParams[i][3] = curveRoutes.toUint8(offset + i + 3);
      route.swapParams[i][4] = curveRoutes.toUint8(offset + i + 4);
    }
    offset += nSwaps * UINT8_SIZE * 5;
    for (uint256 i; i < nSwaps; i++) {
      route.pools[i] = curveRoutes.toAddress(offset + i * ADDRESS_SIZE);
    }
  }

  function routeSize(uint8 nSwaps) internal pure returns (uint256) {
    return
      UINT8_SIZE + // nSwaps
      (nSwaps * 2 + 1) *
      ADDRESS_SIZE + // route
      (nSwaps * 5 * UINT8_SIZE) + // swapParams
      (nSwaps * ADDRESS_SIZE); // pools
  }

  function findRoute(
    bytes memory curveRoutes,
    address tokenIn,
    address tokenOut
  ) internal pure returns (ICurveRouter router, CurveRoute memory route) {
    router = ICurveRouter(curveRoutes.toAddress(0));
    uint8 nRoutes = curveRoutes.toUint8(ADDRESS_SIZE);
    uint256 offset = ADDRESS_SIZE + UINT8_SIZE;
    for (uint256 i; i < nRoutes; i++) {
      uint8 nSwaps = curveRoutes.toUint8(offset);
      if (
        curveRoutes.toAddress(offset + UINT8_SIZE) == tokenIn &&
        curveRoutes.toAddress(offset + UINT8_SIZE + ADDRESS_SIZE * nSwaps * 2) == tokenOut
      ) {
        (, route) = readRoute(curveRoutes, offset);
        return (router, route);
      }
      offset += routeSize(nSwaps);
    }
    revert RouteNotFound(tokenIn, tokenOut);
  }
}
