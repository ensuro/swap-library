const ethers = require("ethers");
const { ZeroAddress } = ethers;

// enum
const Protocols = {
  undefined: 0,
  uniswap: 1,
  curveRouter: 2,
};

function buildUniswapConfig(slippage, feeTier, router) {
  let swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(["uint24", "address"], [feeTier, router]);
  return [Protocols.uniswap, slippage, swapCustomParams];
}

/**
 * Returns SwapParams for curveRouter option, encoding the customParams
 *
 * @param slippage The max splippage to accept
 * @param curveRouter The address of the curve route (ICurveRouter)
 * @param routes List of routes supported. It's a list of objects with `route`, `swapParams` and `pools` attributes
 *               that have the same beaviour of ICurveRouter.exchange parameters.
 *               `pools` is optional.
 *               You don't need to fill with zeros at the end
 */
function buildCurveConfig(slippage, curveRouter, routes) {
  const encodeStream = curveCustomParams(curveRouter, routes);
  return [
    Protocols.curveRouter,
    slippage,
    ethers.solidityPacked(
      encodeStream.map((x) => x.type),
      encodeStream.map((x) => x.value)
    ),
  ];
}

function curveCustomParams(curveRouter, routes) {
  const encodeStream = [
    { type: "address", value: curveRouter },
    { type: "uint8", value: routes.length },
  ];
  const encodedRoutes = routes.map(({ route, swapParams, pools }) => {
    if (route.length < 3 || route.length % 2 !== 1) throw new Error("Invalid route size, must be odd");
    const nSwaps = (route.length - 1) / 2;
    if (swapParams.length !== nSwaps) throw new Error(`Invalid swapParams length, expected ${nSwaps}`);
    if (swapParams.some((sp) => sp.length != 5)) throw new Error("Invalid swapParams, each must have a length of 5");
    if (pools === undefined) {
      pools = Array(nSwaps).fill(ZeroAddress);
    } else {
      if (pools.length !== nSwaps) throw new Error(`Invalid pools length, expected ${nSwaps}`);
    }

    return [
      { type: "uint8", value: nSwaps },
      route.map((r) => ({ type: "address", value: r })),
      swapParams.map((sp) => sp.map((x) => ({ type: "uint8", value: x }))).flat(),
      pools.map((r) => ({ type: "address", value: r })),
    ].flat();
  });
  encodedRoutes.forEach((er) => encodeStream.push(...er));
  return encodeStream;
}

module.exports = {
  Protocols,
  buildUniswapConfig,
  buildCurveConfig,
  curveCustomParams, // Useful for tests
};
