// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VPTFaucet is Ownable {
    IERC20 public immutable vpt;
    IERC20 public immutable link;

    uint256 public constant CLAIM_AMOUNT = 100 * 1e18;
    uint256 public constant BUY_AMOUNT   = 50  * 1e18;

    uint256 public ethPriceWei;     // e.g. 0.001 ether
    uint256 public linkPriceWei;    // e.g. 1 LINK = 1e18

    mapping(address => bool) public hasClaimed;

    constructor(
        address _vpt,
        address _link,
        uint256 _ethPriceWei,
        uint256 _linkPriceWei
    ) Ownable(msg.sender) {
        vpt = IERC20(_vpt);
        link = IERC20(_link);
        ethPriceWei = _ethPriceWei;
        linkPriceWei = _linkPriceWei;
    }

    function claim100() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        hasClaimed[msg.sender] = true;

        require(vpt.transfer(msg.sender, CLAIM_AMOUNT), "VPT transfer failed");
    }

    function buy50WithEth() external payable {
        require(msg.value >= ethPriceWei, "Not enough ETH");
        require(vpt.transfer(msg.sender, BUY_AMOUNT), "VPT transfer failed");
    }

    function buy50WithLink() external {
        require(link.transferFrom(msg.sender, address(this), linkPriceWei), "LINK transfer failed");
        require(vpt.transfer(msg.sender, BUY_AMOUNT), "VPT transfer failed");
    }

    // Owner ops
    function setPrices(uint256 _ethPriceWei, uint256 _linkPriceWei) external onlyOwner {
        ethPriceWei = _ethPriceWei;
        linkPriceWei = _linkPriceWei;
    }

    function withdrawEth(address to) external onlyOwner {
        payable(to).transfer(address(this).balance);
    }

    function withdrawLink(address to) external onlyOwner {
        uint256 bal = link.balanceOf(address(this));
        require(link.transfer(to, bal), "LINK transfer failed");
    }
}
