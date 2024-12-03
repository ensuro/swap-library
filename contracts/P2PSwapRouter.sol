// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title P2PSwapRouter
 * @notice Contract following the interface of ISwapRouter that executes single swaps from authorized contracts
 *         at configured prices, on behalf of an account
 */
contract P2PSwapRouter is ISwapRouter, AccessControl {
  using SafeERC20 for IERC20Metadata;
  using Math for uint256;
  using SafeCast for uint256;

  uint256 internal constant WAD = 1e18;
  bytes32 public constant SWAP_ROLE = keccak256("SWAP_ROLE");
  bytes32 public constant PRICER_ROLE = keccak256("PRICER_ROLE");
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  error NotImplemented();
  error OutputAmountLessThanSlippage(uint256 amountOut, uint256 amountOutMinimum);
  error InputAmountExceedsSlippage(uint256 amountIn, uint256 amountInMaximum);
  error DeadlineInThePast();
  error AmountCannotBeZero();
  error TokenCannotBeZero();
  error RecipientCannotBeZero();

  event PriceUpdated(address tokenIn, address tokenOut, uint256 price);
  event OnBehalfOfChanged(address indexed onBehalfOf);

  mapping(address => mapping(address => uint256)) private _prices;
  address internal _onBehalfOf;

  constructor(address onBehalfOf, address admin) {
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _setOnBehalfOf(onBehalfOf);
  }

  function _setOnBehalfOf(address onBehalfOf) internal {
    _onBehalfOf = onBehalfOf;
    emit OnBehalfOfChanged(onBehalfOf);
  }

  function getOnBehalfOf() external view returns (address) {
    return _onBehalfOf;
  }

  function _toWadFactor(address token) internal view returns (uint256) {
    return (10 ** (18 - IERC20Metadata(token).decimals()));
  }

  /**
   * @inheritdoc ISwapRouter
   */
  function exactInputSingle(
    ExactInputSingleParams calldata params
  ) external payable onlyRole(SWAP_ROLE) returns (uint256 amountOut) {
    require(params.recipient != address(0), RecipientCannotBeZero());
    require(params.deadline >= block.timestamp, DeadlineInThePast());
    require(params.amountIn > 0, AmountCannotBeZero());

    uint256 amountOutInWad = (params.amountIn * _toWadFactor(params.tokenIn)).mulDiv(
      WAD,
      _prices[params.tokenIn][params.tokenOut]
    );
    amountOut = amountOutInWad / _toWadFactor(params.tokenOut);
    require(amountOut >= params.amountOutMinimum, OutputAmountLessThanSlippage(amountOut, params.amountOutMinimum));

    IERC20Metadata(params.tokenIn).safeTransferFrom(msg.sender, _onBehalfOf, params.amountIn);
    IERC20Metadata(params.tokenOut).safeTransferFrom(_onBehalfOf, params.recipient, amountOut);
  }

  /**
   * @inheritdoc ISwapRouter
   */
  function exactOutputSingle(
    ExactOutputSingleParams calldata params
  ) external payable onlyRole(SWAP_ROLE) returns (uint256 amountIn) {
    require(params.recipient != address(0), RecipientCannotBeZero());
    require(params.deadline >= block.timestamp, DeadlineInThePast());
    require(params.amountOut > 0, AmountCannotBeZero());

    uint256 amountInWad = (params.amountOut * _toWadFactor(params.tokenOut)).mulDiv(
      _prices[params.tokenIn][params.tokenOut],
      WAD
    );
    amountIn = amountInWad / _toWadFactor(params.tokenIn);
    require(amountIn <= params.amountInMaximum, InputAmountExceedsSlippage(amountIn, params.amountInMaximum));

    IERC20Metadata(params.tokenIn).safeTransferFrom(msg.sender, _onBehalfOf, amountIn);
    IERC20Metadata(params.tokenOut).safeTransferFrom(_onBehalfOf, params.recipient, params.amountOut);
  }

  function setCurrentPrice(address tokenIn, address tokenOut, uint256 price_) external onlyRole(PRICER_ROLE) {
    require(tokenIn != address(0), TokenCannotBeZero());
    require(tokenOut != address(0), TokenCannotBeZero());
    _prices[tokenIn][tokenOut] = price_;
    emit PriceUpdated(tokenIn, tokenOut, price_);
  }

  function getCurrentPrice(address tokenIn, address tokenOut) external view returns (uint256) {
    return _prices[tokenIn][tokenOut];
  }

  function setOnBehalfOf(address onBehalfOf) external onlyRole(ADMIN_ROLE) {
    _setOnBehalfOf(onBehalfOf);
  }

  /**
   * @inheritdoc ISwapRouter
   * @notice This function is not implemented
   */
  function exactOutput(ExactOutputParams calldata) external payable returns (uint256) {
    revert NotImplemented();
  }

  /**
   * @inheritdoc ISwapRouter
   * @notice This function is not implemented
   */
  function exactInput(ExactInputParams calldata) external payable returns (uint256) {
    revert NotImplemented();
  }

  /**
   * @notice This function is not implemented
   */
  function uniswapV3SwapCallback(int256, int256, bytes calldata) external pure {
    revert NotImplemented();
  }
}
