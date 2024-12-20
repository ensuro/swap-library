const hre = require("hardhat");
const { expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { initForkCurrency, setupChain } = require("@ensuro/utils/js/test-utils");
const { _A, _W } = require("@ensuro/utils/js/utils");
const { buildUniswapConfig, buildCurveConfig } = require("../js/utils");

const { ethers } = hre;
const { ZeroAddress } = ethers;

const ADDRESSES = {
  // polygon mainnet addresses
  UNISWAP: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  USDM: "0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C",
  USDC_NATIVE: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  USDCNativeWhale: "0xD36ec33c8bed5a9F7B6630855f1533455b98a418",
  USDCWhale: "0x4d97dcd97ec945f40cf65f87097ace5ea0476045",
  CURVE_ROUTER: "0xF0d4c12A5768D806021F80a262B4d39d26C58b8D",
};

// const CURRENCY_DECIMALS = 6;
// const _A = amountFunction(CURRENCY_DECIMALS);
// const TEST_BLOCK = 54090000;
const TEST_BLOCK = 57500000;
// const MCENT = 10n; // 1/1000 of a cent
// const CENT = _A("0.01");
const INITIAL = 10000;

// const FEETIER = 3000;

async function setUp() {
  const [, lp, lp2, anon, guardian, admin] = await ethers.getSigners();
  const SwapLibrary = await ethers.getContractFactory("SwapLibrary");
  const swapLibrary = await SwapLibrary.deploy();

  const adminAddr = await ethers.resolveAddress(admin);
  const SwapTesterMock = await ethers.getContractFactory("SwapTesterMock", {
    libraries: {
      SwapLibrary: swapLibrary.target,
    },
  });
  const swapTesterMock = await SwapTesterMock.deploy();

  const currency = await initForkCurrency(
    ADDRESSES.USDC,
    ADDRESSES.USDCWhale,
    [lp, lp2, swapTesterMock],
    [_A(INITIAL), _A(INITIAL), _A(INITIAL)]
  );

  return {
    currency,
    adminAddr,
    lp,
    lp2,
    anon,
    guardian,
    admin,
    swapLibrary,
    swapTesterMock,
  };
}

const tagRegExp = new RegExp("\\[(?<neg>[!])?(?<variant>[a-zA-Z0-9]+)\\]", "gu");

function tagit(testDescription, test, only = false) {
  let any = false;
  const iit = only || this.only ? it.only : it;
  for (const m of testDescription.matchAll(tagRegExp)) {
    if (m === undefined) break;
    const neg = m.groups.neg !== undefined;
    any = any || !neg;
    if (m.groups.variant === this.name) {
      if (!neg) {
        // If tag found and not negated, run the it
        iit(testDescription, test);
        return;
      }
      // If tag found and negated, don't run the it
      return;
    }
  }
  // If no positive tags, run the it
  if (!any) iit(testDescription, test);
}

const variants = [
  {
    name: "Uniswap",
    tagit: tagit,
    fixture: async () => {
      const ret = await setUp();
      ret.swapConfig = buildUniswapConfig(_W("0.02"), 100, ADDRESSES.UNISWAP);
      return ret;
    },
    invalidSwapConfig: buildUniswapConfig(_W("0.02"), 0, ADDRESSES.UNISWAP),
  },
  {
    name: "Curve",
    tagit: tagit,
    fixture: async () => {
      const ret = await setUp();
      ret.swapConfig = buildCurveConfig(_W("0.02"), ADDRESSES.CURVE_ROUTER, [
        {
          route: [
            ADDRESSES.USDC_NATIVE,
            "0x5225010A0AE133B357861782B0B865a48471b2C5", // crvUSD / USDC-native
            "0xc4Ce1D6F5D98D65eE25Cf85e9F2E9DcFEe6Cb5d6", // crvUSD
            "0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03", // crvUSD / USDC-bridged
            ADDRESSES.USDC,
          ],
          swapParams: [
            [1, 0, 1, 1, 2],
            [0, 1, 1, 1, 2],
          ],
          pools: ["0x5225010A0AE133B357861782B0B865a48471b2C5", "0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03"],
        },
        {
          route: [
            ADDRESSES.USDC,
            "0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03", // crvUSD / USDC-bridged
            "0xc4Ce1D6F5D98D65eE25Cf85e9F2E9DcFEe6Cb5d6", // crvUSD
            "0x5225010A0AE133B357861782B0B865a48471b2C5", // crvUSD / USDC-native
            ADDRESSES.USDC_NATIVE,
          ],
          swapParams: [
            [1, 0, 1, 1, 2],
            [0, 1, 1, 1, 2],
          ],
          pools: ["0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03", "0x5225010A0AE133B357861782B0B865a48471b2C5"],
        },
        {
          route: [
            ADDRESSES.USDM,
            "0xd8001cE95A13168AA4F7D70b5298962b7cADf6Dd", // USDC-native / USDM
            ADDRESSES.USDC_NATIVE,
            "0x5225010A0AE133B357861782B0B865a48471b2C5", // crvUSD / USDC-native
            "0xc4Ce1D6F5D98D65eE25Cf85e9F2E9DcFEe6Cb5d6", // crvUSD
            "0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03", // crvUSD / USDC-bridged
            ADDRESSES.USDC,
          ],
          swapParams: [
            [1, 0, 1, 1, 2],
            [1, 0, 1, 1, 2],
            [0, 1, 1, 1, 2],
          ],
          pools: [
            "0xd8001cE95A13168AA4F7D70b5298962b7cADf6Dd",
            "0x5225010A0AE133B357861782B0B865a48471b2C5",
            "0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03",
          ],
        },
        {
          route: [
            ADDRESSES.USDC,
            "0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03", // crvUSD / USDC-bridged
            "0xc4Ce1D6F5D98D65eE25Cf85e9F2E9DcFEe6Cb5d6", // crvUSD
            "0x5225010A0AE133B357861782B0B865a48471b2C5", // crvUSD / USDC-native
            ADDRESSES.USDC_NATIVE,
            "0xd8001cE95A13168AA4F7D70b5298962b7cADf6Dd", // USDC-native / USDM
            ADDRESSES.USDM,
          ],
          swapParams: [
            [1, 0, 1, 1, 2],
            [0, 1, 1, 1, 2],
            [0, 1, 1, 1, 2],
          ],
          pools: [
            "0x864490Cf55dc2Dee3f0ca4D06F5f80b2BB154a03",
            "0x5225010A0AE133B357861782B0B865a48471b2C5",
            "0xd8001cE95A13168AA4F7D70b5298962b7cADf6Dd",
          ],
        },
      ]);
      return ret;
    },
    invalidSwapConfig: buildCurveConfig(_W("0.01"), ZeroAddress, []),
  },
  {
    name: "P2PSwapRouter",
    tagit: tagit,
    fixture: async () => {
      const ret = await setUp();
      const { lp, admin, swapTesterMock, currency } = ret;
      const usdcNative = await initForkCurrency(ADDRESSES.USDC_NATIVE, ADDRESSES.USDCNativeWhale, [lp], [_A(INITIAL)]);

      const P2PSwapRouter = await ethers.getContractFactory("P2PSwapRouter");
      const swapRouter = await P2PSwapRouter.deploy(lp, admin);

      const PRICER_ROLE = await swapRouter.PRICER_ROLE();
      await swapRouter.connect(admin).grantRole(PRICER_ROLE, lp);

      const SWAP_ROLE = await swapRouter.SWAP_ROLE();
      await swapRouter.connect(admin).grantRole(SWAP_ROLE, swapTesterMock);

      await swapRouter.connect(lp).setCurrentPrice(ADDRESSES.USDC, ADDRESSES.USDC_NATIVE, _W("1"));
      await swapRouter.connect(lp).setCurrentPrice(ADDRESSES.USDC_NATIVE, ADDRESSES.USDC, _W("1"));

      await currency.connect(lp).approve(swapRouter, _A(1000));
      await usdcNative.connect(lp).approve(swapRouter, _A(10000));

      ret.swapConfig = buildUniswapConfig(_W("0.02"), 100, swapRouter.target);

      return ret;
    },
    invalidSwapConfig: buildUniswapConfig(_W("0.02"), 0, ADDRESSES.UNISWAP),
  },
];

variants.forEach((variant) => {
  describe(`${variant.name} contract tests`, function () {
    before(async () => {
      await setupChain(TEST_BLOCK);
    });

    variant.tagit("Checks validation with wrong and right config", async () => {
      const { swapTesterMock, swapConfig } = await helpers.loadFixture(variant.fixture);
      await expect(swapTesterMock.validateConfig(swapConfig)).not.to.be.reverted;
      await expect(swapTesterMock.validateConfig(variant.invalidSwapConfig)).to.be.reverted;
    });

    variant.tagit("Checks swaps OK USDC -> USDC_NATIVE and back", async () => {
      const { currency, swapTesterMock, swapConfig } = await helpers.loadFixture(variant.fixture);
      const nativeUSDC = await ethers.getContractAt("IERC20", ADDRESSES.USDC_NATIVE);
      expect(await currency.balanceOf(swapTesterMock)).to.equal(_A(INITIAL));
      let tx = await swapTesterMock.executeExactInput(swapConfig, currency.target, nativeUSDC.target, _A(100), _W("1"));
      let usdc = await currency.balanceOf(swapTesterMock);
      let native = await nativeUSDC.balanceOf(swapTesterMock);
      expect(usdc).to.equal(_A(INITIAL) - _A(100));
      expect(native).to.closeTo(_A(100), _A("0.02"));
      await expect(tx).to.emit(swapTesterMock, "ExactInputResult").withArgs(native); // returns the amount received

      await expect(
        swapTesterMock.executeExactInput(swapConfig, nativeUSDC.target, currency.target, _A(10), _W("1"))
      ).to.emit(swapTesterMock, "ExactInputResult");

      expect(await currency.balanceOf(swapTesterMock)).to.closeTo(_A(INITIAL) - _A(90), _A("0.02"));
      expect(await nativeUSDC.balanceOf(swapTesterMock)).to.equal(native - _A(10));
      usdc = await currency.balanceOf(swapTesterMock);
      native = await nativeUSDC.balanceOf(swapTesterMock);

      tx = await swapTesterMock.executeExactOutput(swapConfig, nativeUSDC.target, currency.target, _A(10), _W("1"));
      expect(await currency.balanceOf(swapTesterMock)).to.closeTo(usdc + _A(10), _A("0.001"));
      expect(await nativeUSDC.balanceOf(swapTesterMock)).to.closeTo(native - _A(10), _A("0.02"));
      await expect(tx)
        .to.emit(swapTesterMock, "ExactOutputResult")
        .withArgs(native - (await nativeUSDC.balanceOf(swapTesterMock)));

      usdc = await currency.balanceOf(swapTesterMock);
      native = await nativeUSDC.balanceOf(swapTesterMock);

      await expect(
        swapTesterMock.executeExactOutput(swapConfig, currency.target, nativeUSDC.target, _A(10), _W("1"))
      ).to.emit(swapTesterMock, "ExactOutputResult");
      expect(await nativeUSDC.balanceOf(swapTesterMock)).to.closeTo(native + _A(10), _A("0.001"));
      expect(await currency.balanceOf(swapTesterMock)).to.closeTo(usdc - _A(10), _A("0.02"));
    });

    variant.tagit("Checks swaps OK USDC -> USDM and back [Curve]", async () => {
      const { currency, swapTesterMock, swapConfig } = await helpers.loadFixture(variant.fixture);
      const USDM = await ethers.getContractAt("IERC20", ADDRESSES.USDM);
      expect(await currency.balanceOf(swapTesterMock)).to.equal(_A(INITIAL));
      let tx = await swapTesterMock.executeExactInput(swapConfig, currency.target, USDM.target, _A(100), _W("1"));
      let usdc = await currency.balanceOf(swapTesterMock);
      let usdm = await USDM.balanceOf(swapTesterMock);
      expect(usdc).to.equal(_A(INITIAL) - _A(100));
      expect(usdm).to.closeTo(_W(100), _W("0.02"));
      await expect(tx)
        .to.emit(swapTesterMock, "ExactInputResult")
        .withArgs(usdm + 1n); // USDM being a rebasing token, the balance can have off-by-one difference

      tx = await swapTesterMock.executeExactInput(swapConfig, USDM.target, currency.target, _W(10), _W("1"));

      expect(await currency.balanceOf(swapTesterMock)).to.closeTo(_A(INITIAL) - _A(90), _A("0.02"));
      expect(await USDM.balanceOf(swapTesterMock)).to.closeTo(usdm - _W(10), 10n);
      await expect(tx)
        .to.emit(swapTesterMock, "ExactInputResult")
        .withArgs((await currency.balanceOf(swapTesterMock)) - usdc);
      usdc = await currency.balanceOf(swapTesterMock);
      usdm = await USDM.balanceOf(swapTesterMock);

      tx = await swapTesterMock.executeExactOutput(swapConfig, USDM.target, currency.target, _A(10), _W("1"));
      expect(await currency.balanceOf(swapTesterMock)).to.closeTo(usdc + _A(10), _A("0.001"));
      expect(await USDM.balanceOf(swapTesterMock)).to.closeTo(usdm - _W(10), _W("0.02"));
      await expect(tx)
        .to.emit(swapTesterMock, "ExactOutputResult")
        .withArgs(usdm - (await USDM.balanceOf(swapTesterMock)) + 1n);

      usdc = await currency.balanceOf(swapTesterMock);
      usdm = await USDM.balanceOf(swapTesterMock);

      await expect(
        swapTesterMock.executeExactOutput(swapConfig, currency.target, USDM.target, _W(10), _W("1"))
      ).to.emit(swapTesterMock, "ExactOutputResult");
      expect(await USDM.balanceOf(swapTesterMock)).to.closeTo(usdm + _W(10), _W("0.001"));
      expect(await currency.balanceOf(swapTesterMock)).to.closeTo(usdc - _A(10), _A("0.02"));
    });
  });
});
