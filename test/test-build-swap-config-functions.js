const hre = require("hardhat");
const { ethers } = hre;

const { expect } = require("chai");
const { buildUniswapConfig, buildCurveConfig, Protocols } = require("../js/utils");
const { _W } = require("../js/test-utils");
const { ZeroAddress } = ethers;

const RND_ADDR = Array(10)
  .fill(0)
  .map((x) => ethers.Wallet.createRandom().address);

// Sizes of each type encoded as hexadecimal
const ADDR_SIZE = 40;
const UINT8_SIZE = 2;

describe("Test build swap config functions", function () {
  it("buildUniswapConfig has the right size", () => {
    const swapConfig = buildUniswapConfig(_W("0.01"), 1000, RND_ADDR[0]);
    expect(swapConfig.length).to.equal(3);
    expect(swapConfig[0]).to.equal(Protocols.uniswap);
    expect(swapConfig[1]).to.equal(_W("0.01"));
    expect(swapConfig[2].length).to.equal(64 * 2 + 2);
    expect(swapConfig[2].slice(0, 2)).to.equal("0x");
  });

  it("buildCurveConfig has the right size - 1 route", () => {
    const routes = [{ route: RND_ADDR.slice(0, 3), swapParams: [[1, 2, 3, 4, 5]] }];
    const swapConfig = buildCurveConfig(_W("0.01"), RND_ADDR[0], routes);
    expect(swapConfig.length).to.equal(3);
    expect(swapConfig[0]).to.equal(Protocols.curveRouter);
    expect(swapConfig[1]).to.equal(_W("0.01"));
    expect(swapConfig[2].slice(0, 2)).to.equal("0x");
    expect(swapConfig[2].length).to.equal(
      2 + ADDR_SIZE + UINT8_SIZE + (UINT8_SIZE + ADDR_SIZE * 3 + UINT8_SIZE * 5 + ADDR_SIZE)
    );
  });

  it("buildCurveConfig has the right size - 2 routes", () => {
    const routes = [
      { route: RND_ADDR.slice(0, 3), swapParams: [[1, 2, 3, 4, 5]] },
      { route: RND_ADDR.slice(1, 6), swapParams: [Array(5).fill(0), Array(5).fill(1)] },
    ];
    const swapConfig = buildCurveConfig(_W("0.01"), RND_ADDR[0], routes);
    expect(swapConfig.length).to.equal(3);
    expect(swapConfig[0]).to.equal(Protocols.curveRouter);
    expect(swapConfig[1]).to.equal(_W("0.01"));
    expect(swapConfig[2].slice(0, 2)).to.equal("0x");
    const firstRouteSize = UINT8_SIZE + ADDR_SIZE * 3 + UINT8_SIZE * 5 + ADDR_SIZE;
    const secondRouteSize = UINT8_SIZE + ADDR_SIZE * 5 + UINT8_SIZE * 5 * 2 + ADDR_SIZE * 2; // 2 swaps
    expect(swapConfig[2].length).to.equal(2 + ADDR_SIZE + UINT8_SIZE + firstRouteSize + secondRouteSize);
  });

  it("buildCurveConfig has the right size - 3 routes", () => {
    const routes = [
      { route: RND_ADDR.slice(0, 3), swapParams: [[1, 2, 3, 4, 5]] },
      { route: RND_ADDR.slice(1, 6), swapParams: [Array(5).fill(0), Array(5).fill(1)] }, // 2 swaps
      { route: RND_ADDR.slice(2, 9), swapParams: Array(3).fill(Array(5).fill(0)), pools: RND_ADDR.slice(0, 3) }, // 3 swaps with pools
    ];
    const swapConfig = buildCurveConfig(_W("0.01"), RND_ADDR[0], routes);
    expect(swapConfig.length).to.equal(3);
    expect(swapConfig[0]).to.equal(Protocols.curveRouter);
    expect(swapConfig[1]).to.equal(_W("0.01"));
    expect(swapConfig[2].slice(0, 2)).to.equal("0x");
    const firstRouteSize = UINT8_SIZE + ADDR_SIZE * 3 + UINT8_SIZE * 5 + ADDR_SIZE;
    const secondRouteSize = UINT8_SIZE + ADDR_SIZE * 5 + UINT8_SIZE * 5 * 2 + ADDR_SIZE * 2; // 2 swaps
    const thirdRouteSize = UINT8_SIZE + ADDR_SIZE * 7 + UINT8_SIZE * 5 * 3 + ADDR_SIZE * 3; // 3 swaps
    expect(swapConfig[2].length).to.equal(
      2 + ADDR_SIZE + UINT8_SIZE + firstRouteSize + secondRouteSize + thirdRouteSize
    );
  });

  it("buildCurveConfig does some validations", () => {
    let routes = [{ route: RND_ADDR.slice(0, 2), swapParams: [[1, 2, 3, 4, 5]] }];
    expect(() => buildCurveConfig(_W("0.01"), RND_ADDR[0], routes)).to.throw("Invalid route size, must be odd");
    routes = [{ route: RND_ADDR.slice(0, 3), swapParams: [] }];
    expect(() => buildCurveConfig(_W("0.01"), RND_ADDR[0], routes)).to.throw("Invalid swapParams length, expected 1");
    routes = [{ route: RND_ADDR.slice(0, 3), swapParams: [[1, 2, 3, 4, 5]], pools: RND_ADDR.slice(0, 2) }];
    expect(() => buildCurveConfig(_W("0.01"), RND_ADDR[0], routes)).to.throw("Invalid pools length, expected 1");
    routes = [{ route: RND_ADDR.slice(0, 3), swapParams: [[1, 2, 3]] }];
    expect(() => buildCurveConfig(_W("0.01"), RND_ADDR[0], routes)).to.throw(
      "Invalid swapParams, each must have a length of 5"
    );
  });
});

describe("Test CurveRoutes library", function () {
  let mock;

  before(async () => {
    const CurveRoutesTesterMock = await ethers.getContractFactory("CurveRoutesTesterMock");
    mock = await CurveRoutesTesterMock.deploy();
  });

  it("CurveRoutes validation", async () => {
    let routes = [{ route: RND_ADDR.slice(0, 3), swapParams: [[1, 2, 3, 4, 5]] }];
    let swapConfig = buildCurveConfig(_W("0.01"), RND_ADDR[0], routes);
    await mock.validate(swapConfig[2]);
    swapConfig = buildCurveConfig(_W("0.01"), RND_ADDR[0], []);
    await expect(mock.validate(swapConfig[2])).to.be.revertedWithCustomError(mock, "AtLeastOneRoute");
  });

  it("CurveRoutes findRoute finds routes", async () => {
    let routes = [
      { route: RND_ADDR.slice(0, 3), swapParams: [[1, 2, 3, 4, 5]] },
      { route: RND_ADDR.slice(1, 4), swapParams: [[5, 4, 3, 2, 1]] },
      {
        route: RND_ADDR.slice(1, 6),
        swapParams: [
          [1, 2, 3, 4, 5],
          [5, 4, 3, 2, 1],
        ],
      },
    ];
    let swapConfig = buildCurveConfig(_W("0.01"), RND_ADDR[9], routes);
    await mock.validate(swapConfig[2]);

    // Checks first route
    let [router, foundRoute] = await mock.findRoute(swapConfig[2], RND_ADDR[0], RND_ADDR[2]);
    let [route, swapParams, pools] = foundRoute;
    expect(route).to.be.deep.equal(RND_ADDR.slice(0, 3).concat(Array(8).fill(ZeroAddress)));
    expect(swapParams).to.be.deep.equal([[1, 2, 3, 4, 5]].concat(Array(4).fill([0, 0, 0, 0, 0])));
    expect(pools).to.be.deep.equal(Array(5).fill(ZeroAddress));
    expect(router).to.be.equal(RND_ADDR[9]);

    // Checks second route
    [router, foundRoute] = await mock.findRoute(swapConfig[2], RND_ADDR[1], RND_ADDR[3]);
    [route, swapParams, pools] = foundRoute;
    expect(route).to.be.deep.equal(RND_ADDR.slice(1, 4).concat(Array(8).fill(ZeroAddress)));
    expect(swapParams).to.be.deep.equal([[5, 4, 3, 2, 1]].concat(Array(4).fill([0, 0, 0, 0, 0])));
    expect(pools).to.be.deep.equal(Array(5).fill(ZeroAddress));
    expect(router).to.be.equal(RND_ADDR[9]);

    // Checks third route
    [router, foundRoute] = await mock.findRoute(swapConfig[2], RND_ADDR[1], RND_ADDR[5]);
    [route, swapParams, pools] = foundRoute;
    expect(route).to.be.deep.equal(RND_ADDR.slice(1, 6).concat(Array(6).fill(ZeroAddress)));
    expect(swapParams).to.be.deep.equal(
      [
        [1, 2, 3, 4, 5],
        [5, 4, 3, 2, 1],
      ].concat(Array(3).fill([0, 0, 0, 0, 0]))
    );
    expect(pools).to.be.deep.equal(Array(5).fill(ZeroAddress));
    expect(router).to.be.equal(RND_ADDR[9]);
  });
});
