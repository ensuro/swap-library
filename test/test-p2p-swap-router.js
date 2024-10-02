const hre = require("hardhat");
const { expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { initCurrency, _A, _W } = require("../js/test-utils");

const { ethers } = hre;

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

        return { usdc, usdcNative, p2pSwapRouter };
    }

    it("Debe permitir un swap exitoso con exactInputSingle", async function () {
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

    it("Debe permitir un swap exitoso con exactOutputSingle", async function () {
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
});
