# AGENTS.md — swap-library

## Repo overview
- **What**: Solidity library for token swaps with a homogeneous interface. Supports Uniswap V3 and Curve Router.
- **Published npm package**: `@ensuro/swaplibrary` (Apache-2.0)
- **Org**: Ensuro — security contact: security@ensuro.co

## Developer environment
- **Node**: v22 (see `.nvmrc`). Use `nvm use` before anything else.
- **Package manager**: npm. Run `npm ci` to install.
- **Solidity**: 0.8.30, optimizer enabled (200 runs), EVM version `prague`.

## Commands

| Purpose | Command |
|---|---|
| Install deps | `npm ci` |
| Compile | `npx hardhat compile` |
| Run all tests | `npx hardhat test` |
| Run tests with gas report | `REPORT_GAS=1 npx hardhat test` |
| Run coverage | `mkdir -p coverage/html/contracts/mocks && npx hardhat test --coverage` |
| Lint Solidity | `npm run solhint` |
| Format code | `npm run prettier` |
| Build NPM package | `scripts/make-npm-package.sh <version> [target-dir]` |

**CI order**: `compile -> contract-size list -> solhint -> test -> coverage`

## Testing
- **Framework**: Mocha + Chai via `@nomicfoundation/hardhat-toolbox-mocha-ethers`
- **Unit tests**: `test/test-swap-library.js` — uses mock contracts in `contracts/mocks/`
- **Fork tests**: `test/test-fork-swap-library.js` — Polygon mainnet fork at block `57500000`
  - Requires env vars: `ALCHEMY_URL` and `ALCHEMY_URL_POLYGON`
  - Tests live swaps against real Uniswap and Curve contracts
- **Helper utilities**: `js/utils.js` exports `Protocols` enum, `buildUniswapConfig()`, `buildCurveConfig()`
- **@ensuro/utils**: Provides `_A()` (6-decimal amounts), `_W()` (18-decimal amounts), `initCurrency()`, `initForkCurrency()`, and custom Chai plugins

## Architecture
```
contracts/
  SwapLibrary.sol       # Core library: exactInput, exactOutput
  CurveRoutes.sol       # Curve route finding and validation
  P2PSwapRouter.sol     # Peer-to-peer swap router
  interfaces/           # Interface definitions
  dependencies/         # External interfaces (ICurveRouter)
  mocks/                # Test-only contracts (SwapTesterMock, SwapRouterMock, etc.)
```
- `SwapLibrary` is a **library**, not a standalone contract. It must be linked to a deploying contract (see `SwapTesterMock` for the pattern).
- SwapConfig struct: `{ protocol, maxSlippage, customParams }` — `customParams` is protocol-specific encoded bytes.

## NPM package
- Built via `scripts/make-npm-package.sh` which:
  1. Compiles with `COMPILE_MODE=production`
  2. Archives contracts/, js/, README.md
  3. Copies artifacts to build/
- Publishes to `./build/npm-package/` — run `npm publish --access public` from there
- Release tags: `latest` (default) or `beta` (for `-beta` versions)

## Linting/formatting
- **Solidity**: solhint + prettier-plugin-solidity (120 char line width)
- **JavaScript**: ESLint (strict rules, see `.eslintrc.js`) + Prettier
- **Pre-commit**: pre-commit hooks run trailing-whitespace, gitleaks, eslint

## Gotchas
- **Coverage requires mkdir workaround** for `coverage/html/contracts/mocks` before running
- **Fork tests need Alchemy RPC URLs** — check `.env` for format, CI uses secrets
- **USDM is a rebasing token** — fork tests allow off-by-one balance differences for USDM
- **ESLint is strict** — many rules enabled that differ from defaults (no var, prefer template, sort imports/vars, etc.)
- **package.json version** uses `%%VERSION%%` placeholder — replaced by build script
