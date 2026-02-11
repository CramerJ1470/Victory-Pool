// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MarketRegistry {
    struct Market {
        string name;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool outcome;
    }

    mapping(uint256 => Market) internal _markets;

    function getMarket(uint256 marketId)
        external
        view
        returns (Market memory)
    {
        return _markets[marketId];
    }

    function addToPool(
        uint256 marketId,
        bool side,
        uint256 amount
    ) external {
        if (side) {
            _markets[marketId].yesPool += amount;
        } else {
            _markets[marketId].noPool += amount;
        }
    }
}
