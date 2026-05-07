import hre from "hardhat";
import { expect } from "chai";

import { initCurrency } from "@ensuro/utils/js/test-utils";
import { _A, _W } from "@ensuro/utils/js/utils";

const connection = await hre.network.connect();
const { networkHelpers: helpers, ethers } = connection;
const { ZeroAddress } = ethers;

describe("P2PSwapRouter Unit Tests", function () {
  async function deployFixture() {
    const [, onBehalfOf, pricer, swapper, anon] = await ethers.getSigners();

    const usdc = await initCurrency(
      ethers,
      { name: "Test USDC", symbol: "USDC", decimals: 6, initial_supply: _A(100000) },
      [onBehalfOf, swapper],
      [_A(1000), _A(2000)]
    );

    const usdcNative = await initCurrency(
      ethers,
      { name: "Test USDC_NATIVE", symbol: "USDC_NATIVE", decimals: 6, initial_supply: _A(100000) },
      [onBehalfOf, swapper],
      [_A(1000), _A(2000)]
    );

    const P2PSwapRouter = await ethers.getContractFactory("P2PSwapRouter");
    const p2pSwapRouter = await P2PSwapRouter.deploy(onBehalfOf, swapper, pricer, []);

    await usdc.connect(onBehalfOf).approve(p2pSwapRouter, _A(1000));
    await usdcNative.connect(onBehalfOf).approve(p2pSwapRouter, _A(1000));

    return { usdc, usdcNative, p2pSwapRouter, onBehalfOf, pricer, swapper, anon };
  }

  it("Should allow a successful swap with exactInputSingle", async function () {
    const { usdc, usdcNative, p2pSwapRouter, onBehalfOf, pricer, swapper } = await helpers.loadFixture(deployFixture);
    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdcNative, usdc, _W("1"));
    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(swapper).exactInputSingle({
      tokenIn: usdcNative,
      tokenOut: usdc,
      amountIn: _A(100),
      fee: 100,
      recipient: swapper,
      deadline: (await helpers.time.latest()) + 3600,
      amountOutMinimum: _A(95),
      sqrtPriceLimitX96: 0,
    });

    const usdcBalanceAfter = await usdc.balanceOf(onBehalfOf);
    const usdcNativeBalanceAfter = await usdcNative.balanceOf(onBehalfOf);

    expect(usdcNativeBalanceAfter).to.equal(_A(1100));
    expect(usdcBalanceAfter).to.equal(_A(900));
  });

  it("Should allow a successful swap with exactOutputSingle", async function () {
    const { usdc, usdcNative, p2pSwapRouter, onBehalfOf, pricer, swapper } = await helpers.loadFixture(deployFixture);

    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, usdcNative, _W("1"));
    await usdc.connect(swapper).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(swapper).exactOutputSingle({
      tokenIn: usdc,
      tokenOut: usdcNative,
      amountOut: _A(95),
      fee: 100,
      recipient: swapper,
      deadline: (await helpers.time.latest()) + 3600,
      amountInMaximum: _A(100),
      sqrtPriceLimitX96: 0,
    });

    const usdcBalanceAfter = await usdc.balanceOf(onBehalfOf);
    const usdcNativeBalanceAfter = await usdcNative.balanceOf(onBehalfOf);

    expect(usdcBalanceAfter).to.equal(_A(1095));
    expect(usdcNativeBalanceAfter).to.equal(_A(905));
  });

  it("exactInputSingle - Should revert if caller is not the swapper", async function () {
    const { usdc, usdcNative, p2pSwapRouter, anon } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(anon).approve(p2pSwapRouter, _A(100));

    const deadline = (await helpers.time.latest()) + 3600;

    await expect(
      p2pSwapRouter.connect(anon).exactInputSingle(
        {
          tokenIn: usdcNative,
          tokenOut: usdc,
          amountIn: _A(100),
          fee: 100,
          recipient: anon,
          deadline: deadline,
          amountOutMinimum: _A(95),
          sqrtPriceLimitX96: 0,
        },
        { gasLimit: 500000 }
      )
    ).to.be.revertedWithCustomError(p2pSwapRouter, "OnlySwapperCanSwap").withArgs(anon);
  });

  it("exactOutputSingle - Should revert if caller is not the swapper", async function () {
    const { usdc, usdcNative, p2pSwapRouter, anon } = await helpers.loadFixture(deployFixture);

    await usdc.connect(anon).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(anon).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: anon,
        deadline: (await helpers.time.latest()) + 3600,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "OnlySwapperCanSwap").withArgs(anon);
  });

  it("exactInputSingle - Should revert if recipient address is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(swapper).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: ZeroAddress,
        deadline: (await helpers.time.latest()) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "RecipientCannotBeZero");
  });

  it("exactInputSingle - Should revert if deadline is in the past", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    const deadline = (await helpers.time.latest()) - 3600 * 24;

    await expect(
      p2pSwapRouter.connect(swapper).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: swapper,
        deadline: deadline,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "DeadlineInThePast");
  });

  it("exactInputSingle - Should revert if amountIn is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(swapper).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: 0,
        fee: 100,
        recipient: swapper,
        deadline: (await helpers.time.latest()) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "AmountCannotBeZero");
  });

  it("exactInputSingle - Should revert if output amount is less than the slippage", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper, pricer } = await helpers.loadFixture(deployFixture);

    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdcNative, usdc, _W("1"));

    await expect(
      p2pSwapRouter.connect(swapper).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: swapper,
        deadline: (await helpers.time.latest()) + 3600,
        amountOutMinimum: _A(200),
        sqrtPriceLimitX96: 0,
      })
    )
      .to.be.revertedWithCustomError(p2pSwapRouter, "OutputAmountLessThanSlippage")
      .withArgs(_A(100), _A(200));
  });

  it("exactOutputSingle - Should revert if recipient address is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await usdc.connect(swapper).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(swapper).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: ZeroAddress,
        deadline: (await helpers.time.latest()) + 3600,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "RecipientCannotBeZero");
  });

  it("exactOutputSingle - Should revert if deadline is in the past", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await usdc.connect(swapper).approve(p2pSwapRouter, _A(100));

    const deadline = (await helpers.time.latest()) - 3600;

    await expect(
      p2pSwapRouter.connect(swapper).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: swapper,
        deadline: deadline,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "DeadlineInThePast");
  });

  it("exactOutputSingle - Should revert if amountOut is zero", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await usdc.connect(swapper).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(swapper).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: 0,
        fee: 100,
        recipient: swapper,
        deadline: (await helpers.time.latest()) + 3600,
        amountInMaximum: _A(100),
        sqrtPriceLimitX96: 0,
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "AmountCannotBeZero");
  });

  it("exactOutputSingle - Should revert if input amount exceeds slippage", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper, pricer } = await helpers.loadFixture(deployFixture);

    await usdc.connect(swapper).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, usdcNative, _W("1"));

    await expect(
      p2pSwapRouter.connect(swapper).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(95),
        fee: 100,
        recipient: swapper,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(50),
        sqrtPriceLimitX96: 0,
      })
    )
      .to.be.revertedWithCustomError(p2pSwapRouter, "InputAmountExceedsSlippage")
      .withArgs(_A(95), _A(50));
  });

  it("Should allow setting price when caller is the pricer", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper, pricer } = await helpers.loadFixture(deployFixture);
    const newPrice = _W("1.5");

    await expect(p2pSwapRouter.connect(swapper).setCurrentPrice(usdc, usdcNative, newPrice))
      .to.be.revertedWithCustomError(p2pSwapRouter, "OnlyPricerCanChangePrice")
      .withArgs(swapper);

    await expect(p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, usdcNative, newPrice))
      .to.emit(p2pSwapRouter, "PriceUpdated")
      .withArgs(usdc, usdcNative, newPrice);

    const updatedPrice = await p2pSwapRouter.getCurrentPrice(usdc, usdcNative);
    expect(updatedPrice).to.equal(newPrice);
  });

  it("Should revert if tokenOut or tokenIn is zero address", async function () {
    const { usdc, p2pSwapRouter, pricer } = await helpers.loadFixture(deployFixture);

    await expect(
      p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, ZeroAddress, _W("1"))
    ).to.be.revertedWithCustomError(p2pSwapRouter, "TokenCannotBeZero");

    await expect(
      p2pSwapRouter.connect(pricer).setCurrentPrice(ZeroAddress, usdc, _W("1"))
    ).to.be.revertedWithCustomError(p2pSwapRouter, "TokenCannotBeZero");
  });

  it("Should revert if caller is not the pricer", async function () {
    const { usdc, usdcNative, p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);
    const newPrice = _W("2");

    await expect(p2pSwapRouter.connect(swapper).setCurrentPrice(usdc, usdcNative, newPrice))
      .to.be.revertedWithCustomError(p2pSwapRouter, "OnlyPricerCanChangePrice")
      .withArgs(swapper);
  });

  it("Should update price multiple times correctly", async function () {
    const { usdc, usdcNative, p2pSwapRouter, pricer } = await helpers.loadFixture(deployFixture);
    const firstPrice = _W("1.2");
    const secondPrice = _W("2.3");

    await expect(p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, usdcNative, firstPrice))
      .to.emit(p2pSwapRouter, "PriceUpdated")
      .withArgs(usdc, usdcNative, firstPrice);

    await expect(p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, usdcNative, secondPrice))
      .to.emit(p2pSwapRouter, "PriceUpdated")
      .withArgs(usdc, usdcNative, secondPrice);
  });

  it("Should revert when exactInput is called", async function () {
    const { p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await expect(
      p2pSwapRouter.connect(swapper).exactInput({
        amountIn: _A(100),
        recipient: swapper,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountOutMinimum: _A(95),
        path: "0x",
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "NotImplemented");
  });

  it("Should revert when exactOutput is called", async function () {
    const { p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await expect(
      p2pSwapRouter.connect(swapper).exactOutput({
        amountOut: _A(95),
        recipient: swapper,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(100),
        path: "0x",
      })
    ).to.be.revertedWithCustomError(p2pSwapRouter, "NotImplemented");
  });

  it("Should revert when uniswapV3SwapCallback is called", async function () {
    const { p2pSwapRouter, swapper } = await helpers.loadFixture(deployFixture);

    await expect(p2pSwapRouter.connect(swapper).uniswapV3SwapCallback(0, 0, "0x")).to.be.revertedWithCustomError(
      p2pSwapRouter,
      "NotImplemented"
    );
  });

  it("Successful input swaps with != 1 price & Slippage error", async function () {
    const { usdc, usdcNative, p2pSwapRouter, onBehalfOf, pricer, swapper } = await helpers.loadFixture(deployFixture);
    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdcNative, usdc, _W("1.02"));
    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(swapper).exactInputSingle({
      tokenIn: usdcNative,
      tokenOut: usdc,
      amountIn: _A(100),
      fee: 100,
      recipient: swapper,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      amountOutMinimum: _A(95),
      sqrtPriceLimitX96: 0,
    });

    let usdcBalanceAfter = await usdc.balanceOf(onBehalfOf);
    let usdcNativeBalanceAfter = await usdcNative.balanceOf(onBehalfOf);

    expect(usdcNativeBalanceAfter).to.equal(_A(1100));
    expect(usdcBalanceAfter).to.be.closeTo(_A(900), _W("1.02"));

    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdcNative, usdc, _W("1.06"));
    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(swapper).exactInputSingle({
        tokenIn: usdcNative,
        tokenOut: usdc,
        amountIn: _A(100),
        fee: 100,
        recipient: swapper,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountOutMinimum: _A(95),
        sqrtPriceLimitX96: 0,
      })
    )
      .to.be.revertedWithCustomError(p2pSwapRouter, "OutputAmountLessThanSlippage")
      .withArgs(_A("94.339622"), _A(95));

    await p2pSwapRouter.connect(swapper).exactInputSingle({
      tokenIn: usdcNative,
      tokenOut: usdc,
      amountIn: _A(100),
      fee: 100,
      recipient: swapper,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      amountOutMinimum: _A(94),
      sqrtPriceLimitX96: 0,
    });

    usdcBalanceAfter = await usdc.balanceOf(onBehalfOf);
    usdcNativeBalanceAfter = await usdcNative.balanceOf(onBehalfOf);

    expect(usdcNativeBalanceAfter).to.equal(_A(1200));
    expect(usdcBalanceAfter).to.be.closeTo(_A(800), _W("1.06"));
  });

  it("Successful output swaps with != 1 price & Slippage error", async function () {
    const { usdc, usdcNative, p2pSwapRouter, onBehalfOf, pricer, swapper } = await helpers.loadFixture(deployFixture);

    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, usdcNative, _W("0.98"));
    await usdc.connect(swapper).approve(p2pSwapRouter, _A(105));
    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(swapper).exactOutputSingle({
      tokenIn: usdc,
      tokenOut: usdcNative,
      amountOut: _A(100),
      fee: 100,
      recipient: swapper,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      amountInMaximum: _A(102),
      sqrtPriceLimitX96: 0,
    });

    let usdcBalanceAfter = await usdc.balanceOf(onBehalfOf);
    let usdcNativeBalanceAfter = await usdcNative.balanceOf(onBehalfOf);

    expect(usdcBalanceAfter).to.be.closeTo(_A(1100), _W("0.98"));
    expect(usdcNativeBalanceAfter).to.be.equal(_A(900));

    await p2pSwapRouter.connect(pricer).setCurrentPrice(usdc, usdcNative, _W("0.94"));
    await usdc.connect(swapper).approve(p2pSwapRouter, _A(105));
    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await expect(
      p2pSwapRouter.connect(swapper).exactOutputSingle({
        tokenIn: usdc,
        tokenOut: usdcNative,
        amountOut: _A(100),
        fee: 100,
        recipient: swapper,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        amountInMaximum: _A(90),
        sqrtPriceLimitX96: 0,
      })
    )
      .to.be.revertedWithCustomError(p2pSwapRouter, "InputAmountExceedsSlippage")
      .withArgs(_A(94), _A(90));

    await p2pSwapRouter.connect(swapper).exactOutputSingle({
      tokenIn: usdc,
      tokenOut: usdcNative,
      amountOut: _A(100),
      fee: 100,
      recipient: swapper,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      amountInMaximum: _A(105),
      sqrtPriceLimitX96: 0,
    });

    usdcBalanceAfter = await usdc.balanceOf(onBehalfOf);
    usdcNativeBalanceAfter = await usdcNative.balanceOf(onBehalfOf);

    expect(usdcBalanceAfter).to.be.closeTo(_A(1200), _W("0.94"));
    expect(usdcNativeBalanceAfter).to.be.equal(_A(800));
  });

  it("Should allow setting prices in the constructor and swap successfully", async function () {
    const { usdc, usdcNative, onBehalfOf, swapper, pricer } = await helpers.loadFixture(deployFixture);

    const P2PSwapRouter = await ethers.getContractFactory("P2PSwapRouter");
    const p2pSwapRouter = await P2PSwapRouter.deploy(onBehalfOf, swapper, pricer, [
      { tokenIn: usdcNative, tokenOut: usdc, price: _W("1") },
      { tokenIn: usdc, tokenOut: usdcNative, price: _W("1") },
    ]);

    await usdc.connect(onBehalfOf).approve(p2pSwapRouter, _A(1000));
    await usdcNative.connect(onBehalfOf).approve(p2pSwapRouter, _A(1000));

    await usdcNative.connect(swapper).approve(p2pSwapRouter, _A(100));

    await p2pSwapRouter.connect(swapper).exactInputSingle({
      tokenIn: usdcNative,
      tokenOut: usdc,
      amountIn: _A(100),
      fee: 100,
      recipient: swapper,
      deadline: (await helpers.time.latest()) + 3600,
      amountOutMinimum: _A(95),
      sqrtPriceLimitX96: 0,
    });

    expect(await usdc.balanceOf(onBehalfOf)).to.equal(_A(900));
    expect(await usdcNative.balanceOf(onBehalfOf)).to.equal(_A(1100));
  });

  it("Should have immutable prices when pricer is ZeroAddress", async function () {
    const { usdc, usdcNative, onBehalfOf, swapper, anon } = await helpers.loadFixture(deployFixture);

    const P2PSwapRouter = await ethers.getContractFactory("P2PSwapRouter");
    const p2pSwapRouter = await P2PSwapRouter.deploy(onBehalfOf, swapper, ZeroAddress, [
      { tokenIn: usdcNative, tokenOut: usdc, price: _W("1") },
      { tokenIn: usdc, tokenOut: usdcNative, price: _W("1") },
    ]);

    await usdc.connect(onBehalfOf).approve(p2pSwapRouter, _A(1000));
    await usdcNative.connect(onBehalfOf).approve(p2pSwapRouter, _A(1000));

    expect(await p2pSwapRouter.getCurrentPrice(usdcNative, usdc)).to.equal(_W("1"));

    await expect(
      p2pSwapRouter.connect(anon).setCurrentPrice(usdcNative, usdc, _W("2"))
    )
      .to.be.revertedWithCustomError(p2pSwapRouter, "OnlyPricerCanChangePrice")
      .withArgs(anon);

    await expect(
      p2pSwapRouter.connect(swapper).setCurrentPrice(usdcNative, usdc, _W("2"))
    )
      .to.be.revertedWithCustomError(p2pSwapRouter, "OnlyPricerCanChangePrice")
      .withArgs(swapper);

    await expect(
      p2pSwapRouter.connect(onBehalfOf).setCurrentPrice(usdcNative, usdc, _W("2"))
    )
      .to.be.revertedWithCustomError(p2pSwapRouter, "OnlyPricerCanChangePrice")
      .withArgs(onBehalfOf);

    expect(await p2pSwapRouter.getCurrentPrice(usdcNative, usdc)).to.equal(_W("1"));
  });
});
