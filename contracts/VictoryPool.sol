// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IVPToken.sol";
import "./MarketRegistry.sol";

contract VictoryPool {
    IVPToken public immutable vpt;
    MarketRegistry public immutable registry;

    struct Bet {
        uint256 amount;
        bool side;
        bool claimed;
    }

    mapping(uint256 => mapping(address => Bet)) public bets;

    constructor(address _vpt, address _registry) {
        vpt = IVPToken(_vpt);
        registry = MarketRegistry(_registry);
    }

    function placeBet(uint256 marketId, bool side, uint256 amount) external {
        MarketRegistry.Market memory m = registry.markets(marketId);
        require(!m.resolved, "Market resolved");
        require(amount > 0, "Zero bet");

        vpt.transferFrom(msg.sender, address(this), amount);

        if (side) {
            registry.markets(marketId).yesPool += amount;
        } else {
            registry.markets(marketId).noPool += amount;
        }

        Bet storage b = bets[marketId][msg.sender];
        b.amount += amount;
        b.side = side;
    }

    function claim(uint256 marketId) external {
        MarketRegistry.Market memory m = registry.markets(marketId);
        Bet storage b = bets[marketId][msg.sender];

        require(m.resolved, "Not resolved");
        require(!b.claimed, "Already claimed");
        require(b.amount > 0, "No bet");

        if (b.side == m.outcome) {
            uint256 totalPool = m.yesPool + m.noPool;
            uint256 winningPool = m.outcome ? m.yesPool : m.noPool;
            if (winningPool > 0) {
                uint256 payout = (b.amount * totalPool) / winningPool;
                vpt.transfer(msg.sender, payout);
            }
        }

        b.claimed = true;
    }
}
