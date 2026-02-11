// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MarketRegistry {
    struct Market {
        string question;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool outcome;
    }

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    event MarketCreated(uint256 indexed marketId, string question);
    event MarketResolved(uint256 indexed marketId, bool outcome);

    function createMarket(string calldata question) external returns (uint256) {
        marketCount++;
        markets[marketCount] = Market(question, 0, 0, false, false);
        emit MarketCreated(marketCount, question);
        return marketCount;
    }

    function resolveMarket(uint256 marketId, bool outcome) external {
        Market storage m = markets[marketId];
        require(!m.resolved, "Already resolved");
        m.resolved = true;
        m.outcome = outcome;
        emit MarketResolved(marketId, outcome);
    }
}
