const hre = require("hardhat");
const { expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { initCurrency, amountFunction } = require("../utils/utils");

const { ethers } = hre;
const { ZeroAddress } = ethers;

// enum
const Protocols = {
  undefined: 0,
  uniswap: 1,
};

describe("SwapLibrary library tests", function () {
  let _A;
  let admin, cust, extra, lp, owner;

  /** Wad function */
  const _W = amountFunction(18);

  beforeEach(async () => {
    [, lp, extra, cust, owner, admin] = await ethers.getSigners();

    _A = amountFunction(6);
  });

  async function deployFixture() {
    const currency = await initCurrency(
      { name: "Test USDC", symbol: "USDC", decimals: 6, initial_supply: _A(50000) },
      [lp, cust, owner, extra],
      [_A("10000"), _A("2000"), _A("1000"), _A("20000")]
    );

    const wmatic = await initCurrency(
      { name: "Test wmatic", symbol: "wmatic", decimals: 18, initial_supply: _W(100000) },
      [lp, cust, extra],
      [_W("8000"), _W("500"), _W("50000")]
    );

    const SwapRouterMock = await ethers.getContractFactory("SwapRouterMock");
    const swapRouter = await SwapRouterMock.deploy(admin.address);
    await swapRouter.waitForDeployment();

    const SwapLibrary = await ethers.getContractFactory("SwapLibrary");
    const library = await SwapLibrary.deploy();

    const SwapTesterMock = await ethers.getContractFactory("SwapTesterMock", {
      libraries: {
        SwapLibrary: library.target,
      },
    });
    const swapTesterMock = await SwapTesterMock.deploy();

    // Deposit some wmatic and usdc
    await helpers.setBalance(extra.address, _W(10000));
    await wmatic.connect(extra).transfer(swapRouter.target, _W(1000));
    await wmatic.connect(extra).transfer(swapTesterMock.target, _W(1000));
    await currency.connect(extra).transfer(swapTesterMock.target, _A(7000));

    return { currency, wmatic, library, swapRouter, swapTesterMock };
  }

  it("SwapLibrary validations", async () => {
    const { currency, wmatic, swapRouter, swapTesterMock } = await helpers.loadFixture(deployFixture);

    await swapRouter.setCurrentPrice(currency.target, wmatic.target, _W("0.62"));

    let swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint24", "address"],
      [_A("0.0005"), swapRouter.target]
    );
    // Slippage cannot be 0
    let swapConfig = [Protocols.uniswap, _W(0), swapCustomParams];
    await expect(
      swapTesterMock.executeExactInput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: maxSlippage cannot be zero");

    await expect(
      swapTesterMock.executeExactOutput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: maxSlippage cannot be zero");

    // Invalid protocol
    swapConfig = [Protocols.undefined, _W("0.02"), swapCustomParams];
    await expect(
      swapTesterMock.executeExactInput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: invalid protocol");

    swapConfig = [Protocols.undefined, _W("0.02"), swapCustomParams];
    await expect(
      swapTesterMock.executeExactOutput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: invalid protocol");

    // Fee tier cannot be 0
    swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(["uint24", "address"], [_A(0), swapRouter.target]);
    swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];
    await expect(
      swapTesterMock.executeExactInput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: feeTier cannot be zero");

    await expect(
      swapTesterMock.executeExactOutput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: feeTier cannot be zero");

    // SwapRouter cannot be ZeroAddress
    swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(["uint24", "address"], [_A("0.0005"), ZeroAddress]);
    swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];
    await expect(
      swapTesterMock.executeExactInput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: SwapRouter address cannot be zero");

    await expect(
      swapTesterMock.executeExactOutput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("SwapLibrary: SwapRouter address cannot be zero");
  });

  it("SwapLibrary exact input", async () => {
    const { currency, wmatic, swapRouter, swapTesterMock } = await helpers.loadFixture(deployFixture);

    const swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint24", "address"],
      [_A("0.0005"), swapRouter.target]
    );
    const swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];

    await swapRouter.setCurrentPrice(currency.target, wmatic.target, _W("0.62"));

    await expect(
      swapTesterMock.executeExactInput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.emit(swapTesterMock, "ExactInputResult");
    // .withArgs(_W("10") / _W("0.62")); // _W("10" / "0.62")
  });

  it("SwapLibrary exact output", async () => {
    const { currency, wmatic, swapRouter, swapTesterMock } = await helpers.loadFixture(deployFixture);

    const swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint24", "address"],
      [_A("0.0005"), swapRouter.target]
    );
    const swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];

    await swapRouter.setCurrentPrice(currency.target, wmatic.target, _W("0.65"));
    await expect(swapTesterMock.executeExactOutput(swapConfig, currency.target, wmatic.target, _W(10), _W("0.65")))
      .to.emit(swapTesterMock, "ExactOutputResult")
      .withArgs(_A("6.5")); // _W(10) * _W("0.65") / 10 ** ( 18 - currency.decimals -->6 )
  });

  it("SwapLibrary exact input with price higger than slippage", async () => {
    const { currency, wmatic, swapRouter, swapTesterMock } = await helpers.loadFixture(deployFixture);

    const swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint24", "address"],
      [_A("0.0005"), swapRouter.target]
    );
    const swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];

    await swapRouter.setCurrentPrice(currency.target, wmatic.target, _W("0.65")); // 0.62 + 3%

    await expect(
      swapTesterMock.executeExactInput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.62"))
    ).to.be.revertedWith("amountOutMinimum not reached");
  });

  it("SwapLibrary exact input with price lower than slippage", async () => {
    const { currency, wmatic, swapRouter, swapTesterMock } = await helpers.loadFixture(deployFixture);

    const swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint24", "address"],
      [_A("0.0005"), swapRouter.target]
    );
    const swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];

    await swapRouter.setCurrentPrice(currency.target, wmatic.target, _W("0.62"));

    await expect(
      swapTesterMock.executeExactInput(swapConfig, currency.target, wmatic.target, _A(10), _W("0.60")) // 0.62 - 3%
    ).to.be.revertedWith("amountOutMinimum not reached");
  });

  it("SwapLibrary exact output with price higger than slippage", async () => {
    const { currency, wmatic, swapRouter, swapTesterMock } = await helpers.loadFixture(deployFixture);

    const swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint24", "address"],
      [_A("0.0005"), swapRouter.target]
    );
    const swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];

    await swapRouter.setCurrentPrice(currency.target, wmatic.target, _W("1.15")); // 1.1 + 3%
    await expect(
      swapTesterMock.executeExactOutput(swapConfig, currency.target, wmatic.target, _W(10), _W("1.1"))
    ).to.be.revertedWith("amountInMaximum exceeded");
  });

  it("SwapLibrary exact output with price lower than slippage", async () => {
    const { currency, wmatic, swapRouter, swapTesterMock } = await helpers.loadFixture(deployFixture);

    const swapCustomParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint24", "address"],
      [_A("0.0005"), swapRouter.target]
    );
    const swapConfig = [Protocols.uniswap, _W("0.02"), swapCustomParams];

    await swapRouter.setCurrentPrice(currency.target, wmatic.target, _W("1.1"));
    await expect(
      swapTesterMock.executeExactOutput(swapConfig, currency.target, wmatic.target, _W(10), _W("1.04")) // 1.1 - 3%
    ).to.be.revertedWith("amountInMaximum exceeded");
  });
});
