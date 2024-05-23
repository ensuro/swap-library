// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

// Generated with cast interface from https://polygonscan.com/address/0xF0d4c12A5768D806021F80a262B4d39d26C58b8D
interface ICurveRouter {
    event Exchange(
        address indexed sender,
        address indexed receiver,
        address[11] route,
        uint256[5][5] swap_params,
        address[5] pools,
        uint256 in_amount,
        uint256 out_amount
    );

    function exchange(address[11] memory _route, uint256[5][5] memory _swap_params, uint256 _amount, uint256 _expected)
        external
        payable
        returns (uint256);
    function exchange(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _amount,
        uint256 _expected,
        address[5] memory _pools
    ) external payable returns (uint256);
    function exchange(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _amount,
        uint256 _expected,
        address[5] memory _pools,
        address _receiver
    ) external payable returns (uint256);
    function get_dx(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _out_amount,
        address[5] memory _pools
    ) external view returns (uint256);
    function get_dx(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _out_amount,
        address[5] memory _pools,
        address[5] memory _base_pools
    ) external view returns (uint256);
    function get_dx(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _out_amount,
        address[5] memory _pools,
        address[5] memory _base_pools,
        address[5] memory _base_tokens
    ) external view returns (uint256);
    function get_dx(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _out_amount,
        address[5] memory _pools,
        address[5] memory _base_pools,
        address[5] memory _base_tokens,
        address[5] memory _second_base_pools
    ) external view returns (uint256);
    function get_dx(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _out_amount,
        address[5] memory _pools,
        address[5] memory _base_pools,
        address[5] memory _base_tokens,
        address[5] memory _second_base_pools,
        address[5] memory _second_base_tokens
    ) external view returns (uint256);
    function get_dy(address[11] memory _route, uint256[5][5] memory _swap_params, uint256 _amount)
        external
        view
        returns (uint256);
    function get_dy(
        address[11] memory _route,
        uint256[5][5] memory _swap_params,
        uint256 _amount,
        address[5] memory _pools
    ) external view returns (uint256);
}
