// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVPToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
}
