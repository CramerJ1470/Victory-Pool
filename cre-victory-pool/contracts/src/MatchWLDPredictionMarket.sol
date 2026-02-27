// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

/// @notice minimal IERC20
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title MatchWLDPredictionMarket (VPT Version)
/// @notice WIN / LOST / DRAW prediction market using ERC20 (VPT) instead of native ETH.
contract MatchWLDPredictionMarket is ReceiverTemplate {
    error MarketDoesNotExist();
    error MarketAlreadySettled();
    error MarketNotSettled();
    error AlreadyPredicted();
    error InvalidAmount();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();
    error InvalidOutcome();

    event MatchMarketCreated(uint256 indexed marketId, string question, address creator);
    event PredictionMade(uint256 indexed marketId, address indexed predictor, Prediction prediction, uint256 amount);
    event SettlementRequested(uint256 indexed marketId, string question);
    event MarketSettled(uint256 indexed marketId, Prediction outcome, uint16 confidence);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    // IMPORTANT: Enum values are 0,1,2 in this order (WIN=0, LOST=1, DRAW=2)
    enum Prediction {
        WIN,
        LOST,
        DRAW
    }

    struct Market {
        address creator;
        uint48 createdAt;
        uint48 settledAt;
        bool settled;
        uint16 confidence;
        Prediction outcome;
        uint256 totalWinPool;
        uint256 totalLostPool;
        uint256 totalDrawPool;
        string question;
    }

    struct UserPrediction {
        uint256 amount;      // amount of VPT deposited
        Prediction prediction;
        bool claimed;
    }

    IERC20 public immutable vpt;

    uint256 internal nextMarketId;
    mapping(uint256 marketId => Market market) internal markets;
    mapping(uint256 marketId => mapping(address user => UserPrediction)) internal predictions;

    /// @notice Constructor sets Forwarder + VPT token
    /// @param _forwarderAddress Chainlink Forwarder address
    /// @param _vpt VPT ERC20 token address
    constructor(address _forwarderAddress, address _vpt) ReceiverTemplate(_forwarderAddress) {
        vpt = IERC20(_vpt);
    }

    // ================================================================
    // │                       Create market                          │
    // ================================================================

    function createMatchMarket(string memory question) public returns (uint256 marketId) {
        marketId = nextMarketId++;

        markets[marketId] = Market({
            creator: msg.sender,
            createdAt: uint48(block.timestamp),
            settledAt: 0,
            settled: false,
            confidence: 0,
            outcome: Prediction.WIN, // placeholder until settled
            totalWinPool: 0,
            totalLostPool: 0,
            totalDrawPool: 0,
            question: question
        });

        emit MatchMarketCreated(marketId, question, msg.sender);
    }

    // ================================================================
    // │                          Predict (VPT)                        │
    // ================================================================

    /// @notice Make a prediction on a market using VPT
    /// @param marketId The ID of the market
    /// @param prediction WIN / LOST / DRAW
    /// @param amount Amount of VPT to deposit
    function predictMatchWithVPT(uint256 marketId, Prediction prediction, uint256 amount) external {
        Market storage m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();
        if (amount == 0) revert InvalidAmount();

        // Validate enum
        if (uint8(prediction) > uint8(Prediction.DRAW)) revert InvalidOutcome();

        UserPrediction storage userPred = predictions[marketId][msg.sender];
        if (userPred.amount != 0) revert AlreadyPredicted();

        // Pull VPT from user (requires prior approve)
        bool ok = vpt.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        userPred.amount = amount;
        userPred.prediction = prediction;
        userPred.claimed = false;

        if (prediction == Prediction.WIN) {
            m.totalWinPool += amount;
        } else if (prediction == Prediction.LOST) {
            m.totalLostPool += amount;
        } else {
            m.totalDrawPool += amount;
        }

        emit PredictionMade(marketId, msg.sender, prediction, amount);
    }

    // ================================================================
    // │                    Request settlement                         │
    // ================================================================

    function requestSettlement(uint256 marketId) external {
        Market storage m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();

        emit SettlementRequested(marketId, m.question);
    }

    // ================================================================
    // │                 Market settlement by CRE                      │
    // ================================================================

    function _settleMarket(bytes calldata report) internal {
        (uint256 marketId, Prediction outcome, uint16 confidence) =
            abi.decode(report, (uint256, Prediction, uint16));

        if (uint8(outcome) > uint8(Prediction.DRAW)) revert InvalidOutcome();

        Market storage m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();

        m.settled = true;
        m.confidence = confidence;
        m.settledAt = uint48(block.timestamp);
        m.outcome = outcome;

        emit MarketSettled(marketId, outcome, confidence);
    }

    function _processReport(bytes calldata report) internal override {
        if (report.length > 0 && report[0] == 0x01) {
            _settleMarket(report[1:]);
        } else {
            string memory question = abi.decode(report, (string));
            createMatchMarket(question);
        }
    }

    // ================================================================
    // │                          Claim (VPT)                          │
    // ================================================================

    function claim(uint256 marketId) external {
        Market storage m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (!m.settled) revert MarketNotSettled();

        UserPrediction storage userPred = predictions[marketId][msg.sender];

        if (userPred.amount == 0) revert NothingToClaim();
        if (userPred.claimed) revert AlreadyClaimed();
        if (userPred.prediction != m.outcome) revert NothingToClaim();

        userPred.claimed = true;

        uint256 totalPool = m.totalWinPool + m.totalLostPool + m.totalDrawPool;

        uint256 winningPool;
        if (m.outcome == Prediction.WIN) {
            winningPool = m.totalWinPool;
        } else if (m.outcome == Prediction.LOST) {
            winningPool = m.totalLostPool;
        } else {
            winningPool = m.totalDrawPool;
        }

        if (winningPool == 0) revert NothingToClaim();

        uint256 payout = (userPred.amount * totalPool) / winningPool;

        bool ok = vpt.transfer(msg.sender, payout);
        if (!ok) revert TransferFailed();

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    // ================================================================
    // │                          Getters                              │
    // ================================================================

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getPrediction(uint256 marketId, address user) external view returns (UserPrediction memory) {
        return predictions[marketId][user];
    }
}