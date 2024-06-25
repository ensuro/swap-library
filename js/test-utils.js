const hre = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

const { ethers } = hre;

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

/**
 * Resets hardhat network to fork on the specified block and url
 */
async function setupChain(block, alchemyUrlEnv = "ALCHEMY_URL") {
  const alchemyUrl = process.env[alchemyUrlEnv];
  if (alchemyUrl === undefined) throw new Error(`Define envvar ${alchemyUrlEnv} for this test`);

  if (block === undefined) throw new Error("Block can't be undefined use null for the current block");
  if (block === null) block = undefined;
  return hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: alchemyUrl,
          blockNumber: block,
        },
      },
    ],
  });
}

/**
 *
 * @param currencyAddress The currency contract address, for example the USDC address
 * @param currencyOrigin An account that holds at least sum(initialBalances) of currency tokens
 * @param initialTargets Array of addresses that will receive the initial balances
 * @param initialBalances Initial balances for each address
 */
async function initForkCurrency(currencyAddress, currencyOrigin, initialTargets, initialBalances) {
  const currency = await ethers.getContractAt("IERC20", currencyAddress);
  await helpers.impersonateAccount(currencyOrigin);
  await helpers.setBalance(currencyOrigin, ethers.parseEther("100"));
  const whale = await ethers.getSigner(currencyOrigin);
  await Promise.all(
    initialTargets.map(async function (user, index) {
      await currency.connect(whale).transfer(user, initialBalances[index]);
    })
  );
  return currency;
}

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

const _W = amountFunction(18);
const _A = amountFunction(6);

module.exports = {
  amountFunction,
  initForkCurrency,
  initCurrency,
  setupChain,
  _A,
  _W,
};
