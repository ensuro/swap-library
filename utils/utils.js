const hre = require("hardhat");
const { ethers } = hre;

// enum
const Protocols = {
  undefined: 0,
  uniswap: 1,
};

async function initCurrency(options, initial_targets, initial_balances) {
  const Currency = await ethers.getContractFactory(options.contractClass || "TestCurrency");
  let currency = await Currency.deploy(
    options.name || "Test Currency",
    options.symbol || "TEST",
    options.initial_supply,
    options.decimals || 18
  );
  initial_targets = initial_targets || [];
  await Promise.all(
    initial_targets.map(async function (user, index) {
      await currency.transfer(user.address, initial_balances[index]);
    })
  );
  return currency;
}

/**
 * Creates a fixed-point conversion function for the desired number of decimals
 * @param decimals The number of decimals. Must be >= 6.
 * @returns The amount function created. The function can receive strings (recommended),
 *          floats/doubles (not recommended) and integers.
 *
 *          Floats will be rounded to 6 decimal before scaling.
 */
function amountFunction(decimals) {
  return function (value) {
    if (value === undefined) return undefined;

    if (typeof value === "string" || value instanceof String) {
      return ethers.parseUnits(value, decimals);
    }

    if (!Number.isInteger(value)) {
      return BigInt(Math.round(value * 1e6).toString()) * BigInt(Math.pow(10, decimals - 6).toString());
    }

    return BigInt(value.toString()) * BigInt("10") ** BigInt(decimals.toString());
  };
}

function buildUniswapConfig(protocol, slippage, feeTier, router) {
  let swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(["uint24", "address"], [feeTier, router]);
  return [protocol, slippage, swapCustomParams];
}

module.exports = {
  Protocols,
  initCurrency,
  amountFunction,
  buildUniswapConfig,
};
