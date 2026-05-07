import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import HardhatContractSizer from "@solidstate/hardhat-contract-sizer";

import { use } from "chai";
import { chaiAccessControl } from "@ensuro/utils/js/chai-plugins";

use(chaiAccessControl);

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, HardhatContractSizer],
  solidity: {
    version: "0.8.35",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "prague",
    },
    npmFilesToBuild: ["@openzeppelin/contracts/token/ERC20/IERC20.sol"],
  },
  // This is ignored as of HH 3.1.5, but I leave it here for future reference
  coverage: {
    skipFiles: ["contracts/mocks/", "contracts/dependencies/"],
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
  },
});
