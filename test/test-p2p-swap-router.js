const hre = require("hardhat");
const { expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { initCurrency, _A, _W } = require("../js/test-utils");

const { ethers } = hre;
const { ZeroAddress } = ethers;

describe("P2PSwapRouter Unit Tests", function () {
  async function deployFixture() {
    const [, seller, admin, buyer] = await ethers.getSigners();

    const usdc = await initCurrency(
      { name: "Test USDC", symbol: "USDC", decimals: 6, initial_supply: _A(100000) },
      [seller, buyer],
      [_A(1000), _A(2000)]
    );

    const usdcNative = await initCurrency(
      { name: "Test USDC_NATIVE", symbol: "USDC_NATIVE", decimals: 6, initial_supply: _A(100000) },
      [seller, buyer],
      [_A(1000), _A(2000)]
    );

    const P2PSwapRouter = await ethers.getContractFactory("P2PSwapRouter");
    const p2pSwapRouter = await P2PSwapRouter.deploy(seller, admin);

    const ADMIN_ROLE = await p2pSwapRouter.ADMIN_ROLE();
    await p2pSwapRouter.connect(admin).grantRole(ADMIN_ROLE, admin);

    const PRICER_ROLE = await p2pSwapRouter.PRICER_ROLE();
    await p2pSwapRouter.connect(admin).grantRole(PRICER_ROLE, seller);

    const SWAP_ROLE = await p2pSwapRouter.SWAP_ROLE();
    await p2pSwapRouter.connect(admin).grantRole(SWAP_ROLE, buyer);

    await usdc.connect(seller).approve(p2pSwapRouter, _A(1000));
    await usdcNative.connect(seller).approve(p2pSwapRouter, _A(1000));

    return { usdc, usdcNative, p2pSwapRouter, seller, admin, buyer };
  }

  it("Should allow a successful swap with exactInputSingle", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller, buyer } = await helpers.loadFixture(deployFixture);
    await p2pSwapRouter.connect(seller).setCurrentPrice(usdcNative, usdc, _W("1"));
    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(buyer).exactInputSingle({
      tokenIn: usdcNative,
      tokenOut: usdc,
      amountIn: _A(100),
      fee: 100,
      recipient: buyer,
      deadline: (await helpers.time.latest()) + 3600,
      amountOutMinimum: _A(95),
      sqrtPriceLimitX96: 0,
    });

    const usdcBalanceAfter = await usdc.balanceOf(seller);
    const usdcNativeBalanceAfter = await usdcNative.balanceOf(seller);

    expect(usdcNativeBalanceAfter).to.equal(_A(1100));
    expect(usdcBalanceAfter).to.equal(_A(900));
  });

  it("Should allow a successful swap with exactOutputSingle", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller, buyer } = await helpers.loadFixture(deployFixture);

    await p2pSwapRouter.connect(seller).setCurrentPrice(usdc, usdcNative, _W("1"));
    await usdc.connect(buyer).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(buyer).exactOutputSingle({
      tokenIn: usdc,
      tokenOut: usdcNative,
      amountOut: _A(95),
      fee: 100,
      recipient: buyer,
      deadline: (await helpers.time.latest()) + 3600,
      amountInMaximum: _A(100),
      sqrtPriceLimitX96: 0,
    });

    const usdcBalanceAfter = await usdc.balanceOf(seller);
    const usdcNativeBalanceAfter = await usdcNative.balanceOf(seller);

    expect(usdcBalanceAfter).to.equal(_A(1095));
    expect(usdcNativeBalanceAfter).to.equal(_A(905));
  });

  it("exactInputSingle - Should revert if caller does not have SWAP_ROLE", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller, buyer } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(seller).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: seller,
        deadline: (await helpers.time.latest()) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith(
      `AccessControl: account ${seller.address.toLowerCase()} is missing role ${await p2pSwapRouter.SWAP_ROLE()}`
    );
  });

  it("exactOutputSingle - Should revert if caller does not have SWAP_ROLE", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller, buyer } = await helpers.loadFixture(deployFixture);

    await usdc.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(seller).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: seller,
        deadline: (await helpers.time.latest()) + 3600,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith(
      `AccessControl: account ${seller.address.toLowerCase()} is missing role ${await p2pSwapRouter.SWAP_ROLE()}`
    );
  });

  it("exactInputSingle - Should revert if recipient address is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: ZeroAddress,
        deadline: (await helpers.time.latest()) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("Recipient cannot be zero address");
  });

  it("exactInputSingle - Should revert if deadline is in the past", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    const deadline = (await helpers.time.latest()) - 3600 * 24;

    await expect(
      p2pSwapRouter.connect(buyer).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: deadline,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("Deadline in the past");
  });

  it("exactInputSingle - Should revert if amountIn is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: 0,
        fee: 100,
        recipient: buyer,
        deadline: (await helpers.time.latest()) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("amountIn cannot be zero");
  });

  it("exactInputSingle - Should revert if output amount is less than the slippage", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer, seller } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(seller).setCurrentPrice(usdcNative, usdc, _W("1"));

    await expect(
      p2pSwapRouter.connect(buyer).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: (await helpers.time.latest()) + 3600,
        amountOutMinimum: _A(200),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("The output amount is less than the slippage");
  });

  it("exactOutputSingle - Should revert if recipient address is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await usdc.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: ZeroAddress,
        deadline: (await helpers.time.latest()) + 3600,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("Recipient cannot be zero address");
  });

  it("exactOutputSingle - Should revert if deadline is in the past", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await usdc.connect(buyer).approve(p2pSwapRouter, _A(100));

    const deadline = (await helpers.time.latest()) - 3600;

    await expect(
      p2pSwapRouter.connect(buyer).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: buyer,
        deadline: deadline,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("Deadline in the past");
  });

  it("exactOutputSingle - Should revert if amountOut is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await usdc.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: 0,
        fee: 100,
        recipient: buyer,
        deadline: (await helpers.time.latest()) + 3600,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("AmountOut cannot be zero");
  });

  it("exactOutputSingle - Should revert if input amount exceeds slippage", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer, seller } = await helpers.loadFixture(deployFixture);

    await usdc.connect(buyer).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(seller).setCurrentPrice(usdc, usdcNative, _W("1"));

    await expect(
      p2pSwapRouter.connect(buyer).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(50),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("The input amount exceeds the slippage");
  });

  it("Should allow setting price when caller has PRICER_ROLE", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller, buyer } = await helpers.loadFixture(deployFixture);
    const newPrice = _W("1.5");

    await expect(p2pSwapRouter.connect(buyer).setCurrentPrice(usdc, usdcNative, newPrice)).to.be.revertedWith(
      `AccessControl: account ${buyer.address.toLowerCase()} is missing role ${await p2pSwapRouter.PRICER_ROLE()}`
    );

    await expect(p2pSwapRouter.connect(seller).setCurrentPrice(usdc, usdcNative, newPrice))
      .to.emit(p2pSwapRouter, "PriceUpdated")
      .withArgs(usdc, usdcNative, newPrice);

    const updatedPrice = await p2pSwapRouter.getCurrentPrice(usdc, usdcNative);
    expect(updatedPrice).to.equal(newPrice);
  });

  it("Should revert if tokenOut or tokenIn is zero address", async function () {
    const { usdc, p2pSwapRouter, seller } = await helpers.loadFixture(deployFixture);

    await expect(p2pSwapRouter.connect(seller).setCurrentPrice(usdc, ZeroAddress, _W("1"))).to.be.revertedWith(
      "P2PSwapRouter: tokenOut cannot be the zero address"
    );

    await expect(p2pSwapRouter.connect(seller).setCurrentPrice(ZeroAddress, usdc, _W("1"))).to.be.revertedWith(
      "P2PSwapRouter: tokenIn cannot be the zero address"
    );
  });

  it("Should revert if caller does not have PRICER_ROLE", async function () {
    const { usdc, usdcNative, p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);
    const newPrice = _W("2");

    await expect(p2pSwapRouter.connect(buyer).setCurrentPrice(usdc, usdcNative, newPrice)).to.be.revertedWith(
      `AccessControl: account ${buyer.address.toLowerCase()} is missing role ${await p2pSwapRouter.PRICER_ROLE()}`
    );
  });

  it("Should update price multiple times correctly", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller } = await helpers.loadFixture(deployFixture);
    const firstPrice = _W("1.2");
    const secondPrice = _W("2.3");

    await expect(p2pSwapRouter.connect(seller).setCurrentPrice(usdc, usdcNative, firstPrice))
      .to.emit(p2pSwapRouter, "PriceUpdated")
      .withArgs(usdc, usdcNative, firstPrice);

    await expect(p2pSwapRouter.connect(seller).setCurrentPrice(usdc, usdcNative, secondPrice))
      .to.emit(p2pSwapRouter, "PriceUpdated")
      .withArgs(usdc, usdcNative, secondPrice);
  });

  it("Should revert when exactInput is called", async function () {
    const { p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await expect(
      p2pSwapRouter.connect(buyer).exactInput({
        amountIn: _A(100),
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountOutMinimum: _A(95),
        path: "0x",
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "NotImplemented");
  });

  it("Should revert when exactOutput is called", async function () {
    const { p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await expect(
      p2pSwapRouter.connect(buyer).exactOutput({
        amountOut: _A(95),
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(100),
        path: "0x",
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "NotImplemented");
  });

  it("Should revert when uniswapV3SwapCallback is called", async function () {
    const { p2pSwapRouter, buyer } = await helpers.loadFixture(deployFixture);

    await expect(p2pSwapRouter.connect(buyer).uniswapV3SwapCallback(0, 0, "0x")).to.be.revertedWithCustomError(
      p2pSwapRouter,
      "NotImplemented"
    );
  });

  it("Should allow setting onBehalfOf when caller has ADMIN_ROLE", async function () {
    const { p2pSwapRouter, admin, buyer } = await helpers.loadFixture(deployFixture);

    await expect(p2pSwapRouter.connect(admin).setOnBehalfOf(buyer))
      .to.emit(p2pSwapRouter, "OnBehalfOfChanged")
      .withArgs(buyer);

    const newOnBehalfOf = await p2pSwapRouter.getOnBehalfOf();
    expect(newOnBehalfOf).to.equal(buyer.address);
  });

  it("Should revert if caller does not have ADMIN_ROLE", async function () {
    const { p2pSwapRouter, buyer, seller } = await helpers.loadFixture(deployFixture);

    await expect(p2pSwapRouter.connect(seller).setOnBehalfOf(buyer)).to.be.revertedWith(
      `AccessControl: account ${seller.address.toLowerCase()} is missing role ${await p2pSwapRouter.ADMIN_ROLE()}`
    );
  });

  it("Successful input swaps with != 1 price & Slippage error", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller, buyer } = await helpers.loadFixture(deployFixture);
    await p2pSwapRouter.connect(seller).setCurrentPrice(usdcNative, usdc, _W("1.02"));
    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).not.to.be.reverted;

    let usdcBalanceAfter = await usdc.balanceOf(seller);
    let usdcNativeBalanceAfter = await usdcNative.balanceOf(seller);

    expect(usdcNativeBalanceAfter).to.equal(_A(1100));
    expect(usdcBalanceAfter).to.be.closeTo(_A(900), _W("1.02"));

    await p2pSwapRouter.connect(seller).setCurrentPrice(usdcNative, usdc, _W("1.06"));
    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("The output amount is less than the slippage");

    await expect(
      p2pSwapRouter.connect(buyer).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountOutMinimum: _A(94),
        sqrtPriceLimitX96: 0,
      })
    ).not.to.be.reverted;

    usdcBalanceAfter = await usdc.balanceOf(seller);
    usdcNativeBalanceAfter = await usdcNative.balanceOf(seller);

    expect(usdcNativeBalanceAfter).to.equal(_A(1200));
    expect(usdcBalanceAfter).to.be.closeTo(_A(800), _W("1.06"));
  });

  it("Successful output swaps with != 1 price & Slippage error", async function () {
    const { usdc, usdcNative, p2pSwapRouter, seller, buyer } = await helpers.loadFixture(deployFixture);

    await p2pSwapRouter.connect(seller).setCurrentPrice(usdc, usdcNative, _W("0.98"));
    await usdc.connect(buyer).approve(p2pSwapRouter, _A(105));
    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(102),
        sqrtPriceLimitX96: 0,
      })
    ).not.to.be.reverted;

    let usdcBalanceAfter = await usdc.balanceOf(seller);
    let usdcNativeBalanceAfter = await usdcNative.balanceOf(seller);

    expect(usdcBalanceAfter).to.be.closeTo(_A(1100), _W("0.98"));
    expect(usdcNativeBalanceAfter).to.be.equal(_A(900));

    await p2pSwapRouter.connect(seller).setCurrentPrice(usdc, usdcNative, _W("0.94"));
    await usdc.connect(buyer).approve(p2pSwapRouter, _A(105));
    await usdcNative.connect(buyer).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(buyer).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(90),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWith("The input amount exceeds the slippage");

    await expect(
      p2pSwapRouter.connect(buyer).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(100),
        fee: 100,
        recipient: buyer,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(105),
        sqrtPriceLimitX96: 0,
      })
    ).not.to.be.reverted;

    usdcBalanceAfter = await usdc.balanceOf(seller);
    usdcNativeBalanceAfter = await usdcNative.balanceOf(seller);

    expect(usdcBalanceAfter).to.be.closeTo(_A(1200), _W("0.94"));
    expect(usdcNativeBalanceAfter).to.be.equal(_A(800));
  });
});
