const hre = require("hardhat");
const { ethers } = hre;

// enum
const Protocols = {
  undefined: 0,
  uniswap: 1,
};

function buildUniswapConfig(slippage, feeTier, router) {
  let swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(["uint24", "address"], [feeTier, router]);
  return [Protocols.uniswap, slippage, swapCustomParams];
}

module.exports = {
  Protocols,
  buildUniswapConfig,
};
