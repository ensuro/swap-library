const hre = require("hardhat");
const { expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { initCurrency, _A, _W } = require("../js/test-utils");

const { ethers } = hre;
const { ZeroAddress } = ethers;

describe("P2PSwapRouter Unit Tests", function () {
    let admin, lp, swapTesterMock;

    async function setUp() {
        [ , lp, admin, swapTesterMock ] = await ethers.getSigners();
    }

    async function deployFixture() {

        const usdc = await initCurrency(
        { name: "Test USDC", symbol: "USDC", decimals: 6, initial_supply: _A(100000) },
        [lp, swapTesterMock],
        [_A(1000), _A(2000)]
        );


        const usdcNative = await initCurrency(
        { name: "Test USDC_NATIVE", symbol: "USDC_NATIVE", decimals: 6, initial_supply: _A(100000) },
        [lp, swapTesterMock],
        [_A(1000), _A(2000)]
        );

        const P2PSwapRouter = await ethers.getContractFactory("P2PSwapRouter");
        const p2pSwapRouter = await P2PSwapRouter.deploy(lp, admin);

        const PRICER_ROLE = await p2pSwapRouter.PRICER_ROLE();
        await p2pSwapRouter.connect(admin).grantRole(PRICER_ROLE, lp);

        const SWAP_ROLE = await p2pSwapRouter.SWAP_ROLE();
        await p2pSwapRouter.connect(admin).grantRole(SWAP_ROLE, swapTesterMock);

        await usdc.connect(lp).approve(p2pSwapRouter, _A(1000));
        await usdcNative.connect(lp).approve(p2pSwapRouter, _A(1000));

        return { usdc, usdcNative, p2pSwapRouter, PRICER_ROLE };
    }

    it("Should allow a successful swap with exactInputSingle", async function () {
        await setUp();
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
        await p2pSwapRouter.connect(lp).setCurrentPrice(usdcNative, usdc,_W("1"));
        await usdcNative.connect(swapTesterMock).approve(p2pSwapRouter, _A(100));

        await p2pSwapRouter.connect(swapTesterMock).exactInputSingle({
            tokenIn: usdcNative.target,
            tokenOut: usdc.target,
            amountIn: _A(100),
            fee: 100,
            recipient: lp,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountOutMinimum: _A(95),
            sqrtPriceLimitX96: 0,
        });

        const usdcBalanceAfter = await usdc.balanceOf(lp);
        const usdcNativeBalanceAfter = await usdcNative.balanceOf(lp);

        expect(usdcNativeBalanceAfter).to.equal(_A(1100)); 
        expect(usdcBalanceAfter).to.equal(_A(900));
    });

    it("Should allow a successful swap with exactOutputSingle", async function () {
        await setUp();
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
      
        await p2pSwapRouter.connect(lp).setCurrentPrice(usdc, usdcNative, _W("1"));
        await usdc.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));
    
        await p2pSwapRouter.connect(swapTesterMock).exactOutputSingle({
          tokenIn: usdc.target,
          tokenOut: usdcNative.target,
          amountOut: _A(95),
          fee: 100,
          recipient: lp,
          deadline: Math.floor(Date.now() / 1000) + 3600,
          amountInMaximum: _A(100),
          sqrtPriceLimitX96: 0,
        });
      
        const usdcBalanceAfter = await usdc.balanceOf(lp);
        const usdcNativeBalanceAfter = await usdcNative.balanceOf(lp);
      
        expect(usdcBalanceAfter).to.equal(_A(1095));
        expect(usdcNativeBalanceAfter).to.equal(_A(905));
    });

    it("exactInputSingle - Should revert if recipient address is zero", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdcNative.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));

        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactInputSingle({
                tokenIn: usdcNative.target,
                tokenOut: usdc.target,
                amountIn: _A(100),
                fee: 100,
                recipient: ZeroAddress,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                amountOutMinimum: _A(95),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("Recipient cannot be zero address");
    });

    it("exactInputSingle - Should revert if deadline is in the past", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdcNative.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));
    
        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactInputSingle({
                tokenIn: usdcNative.target,
                tokenOut: usdc.target,
                amountIn: _A(100),
                fee: 100,
                recipient: lp,
                deadline: Math.floor(Date.now() / 1000) - 3600,
                amountOutMinimum: _A(95),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("Deadline in the past");
    });

    it("exactInputSingle - Should revert if amountIn is zero", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdcNative.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));
    
        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactInputSingle({
                tokenIn: usdcNative.target,
                tokenOut: usdc.target,
                amountIn: 0,
                fee: 100,
                recipient: lp,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                amountOutMinimum: _A(95),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("amountIn cannot be zero");
    });

    it("exactInputSingle - Should revert if output amount is less than the slippage", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdcNative.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));
    
        await p2pSwapRouter.connect(lp).setCurrentPrice(usdcNative.target, usdc.target, _W("1"));

        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactInputSingle({
                tokenIn: usdcNative.target,
                tokenOut: usdc.target,
                amountIn: _A(100),
                fee: 100,
                recipient: lp,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                amountOutMinimum: _A(200),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("The output amount is less than the slippage");
    });

    it("exactOutputSingle - Should revert if recipient address is zero", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdc.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));

        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactOutputSingle({
                tokenIn: usdc.target,
                tokenOut: usdcNative.target,
                amountOut: _A(95),
                fee: 100,
                recipient: ZeroAddress,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                amountInMaximum: _A(100),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("Recipient cannot be zero address");
    });

    it("exactOutputSingle - Should revert if deadline is in the past", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdc.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));
    
        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactOutputSingle({
                tokenIn: usdc.target,
                tokenOut: usdcNative.target,
                amountOut: _A(95),
                fee: 100,
                recipient: lp,
                deadline: Math.floor(Date.now() / 1000) - 3600,
                amountInMaximum: _A(100),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("Deadline in the past");
    });

    it("exactOutputSingle - Should revert if amountOut is zero", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdc.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));
    
        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactOutputSingle({
                tokenIn: usdc.target,
                tokenOut: usdcNative.target,
                amountOut: 0,
                fee: 100,
                recipient: lp,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                amountInMaximum: _A(100),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("AmountOut cannot be zero");
    });

    it("exactOutputSingle - Should revert if input amount exceeds slippage", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await usdc.connect(swapTesterMock).approve(p2pSwapRouter.target, _A(100));

        await p2pSwapRouter.connect(lp).setCurrentPrice(usdc.target, usdcNative.target, _W("1"));

        await expect(
            p2pSwapRouter.connect(swapTesterMock).exactOutputSingle({
                tokenIn: usdc.target,
                tokenOut: usdcNative.target,
                amountOut: _A(95),
                fee: 100,
                recipient: lp,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                amountInMaximum: _A(50),
                sqrtPriceLimitX96: 0,
            })
        ).to.be.revertedWith("The input amount exceeds the slippage");
    });

    it("Should allow setting price when caller has PRICER_ROLE", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
        const newPrice = _W("1.5");
    
        await expect(
            p2pSwapRouter.connect(lp).setCurrentPrice(usdc.target, usdcNative.target, newPrice)
        ).to.emit(p2pSwapRouter, "PriceUpdated")
          .withArgs(usdc.target, usdcNative.target, newPrice);
    });
    
    it("Should revert if tokenIn is zero address", async function () {
        const { usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await expect(
            p2pSwapRouter.connect(lp).setCurrentPrice(ZeroAddress, usdcNative.target, _W("1"))
        ).to.be.revertedWith("P2PSwapRouter: tokenIn cannot be the zero address");
    });
    
    it("Should revert if tokenOut is zero address", async function () {
        const { usdc, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
    
        await expect(
            p2pSwapRouter.connect(lp).setCurrentPrice(usdc.target, ZeroAddress, _W("1"))
        ).to.be.revertedWith("P2PSwapRouter: tokenOut cannot be the zero address");
    });
    
    it("Should revert if caller does not have PRICER_ROLE", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
        const newPrice = _W("2");
    
        await expect(
            p2pSwapRouter.connect(swapTesterMock).setCurrentPrice(usdc.target, usdcNative.target, newPrice)
        ).to.be.revertedWith(
            `AccessControl: account ${swapTesterMock.address.toLowerCase()} is missing role ${await p2pSwapRouter.PRICER_ROLE()}`
        );
    });
    
    it("Should update price multiple times correctly", async function () {
        const { usdc, usdcNative, p2pSwapRouter } = await helpers.loadFixture(deployFixture);
        const firstPrice = _W("1.2");
        const secondPrice = _W("2.3");
    
        await expect(
            p2pSwapRouter.connect(lp).setCurrentPrice(usdc.target, usdcNative.target, firstPrice)
        ).to.emit(p2pSwapRouter, "PriceUpdated")
          .withArgs(usdc.target, usdcNative.target, firstPrice);
    
        await expect(
            p2pSwapRouter.connect(lp).setCurrentPrice(usdc.target, usdcNative.target, secondPrice)
        ).to.emit(p2pSwapRouter, "PriceUpdated")
          .withArgs(usdc.target, usdcNative.target, secondPrice);
    });
    
});
