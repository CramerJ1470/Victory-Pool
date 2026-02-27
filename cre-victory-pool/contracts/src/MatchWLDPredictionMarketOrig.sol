// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

/// @title MatchWLDPredictionMarket
/// @notice A simplified prediction market for CRE bootcamp (WIN / LOST / DRAW).
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
        uint256 amount;
        Prediction prediction;
        bool claimed;
    }

    uint256 internal nextMarketId;
    mapping(uint256 marketId => Market market) internal markets;
    mapping(uint256 marketId => mapping(address user => UserPrediction)) internal predictions;

    /// @notice Constructor sets the Chainlink Forwarder address for security
    /// @param _forwarderAddress The address of the Chainlink KeystoneForwarder contract
    /// @dev For Sepolia testnet, use: 0x15fc6ae953e024d975e77382eeec56a9101f9f88
    constructor(address _forwarderAddress) ReceiverTemplate(_forwarderAddress) {}

    // ================================================================
    // │                       Create market                          │
    // ================================================================

    /// @notice Create a new prediction market.
    /// @param question The question for the market.
    /// @return marketId The ID of the newly created market.
    function createMatchMarket(string memory question) public returns (uint256 marketId) {
        marketId = nextMarketId++;

        markets[marketId] = Market({
            creator: msg.sender,
            createdAt: uint48(block.timestamp),
            settledAt: 0,
            settled: false,
            confidence: 0,
            outcome: Prediction.WIN, // default placeholder until settled
            totalWinPool: 0,
            totalLostPool: 0,
            totalDrawPool: 0,
            question: question
        });
// console.log("Market created with ID:", marketId, "Question:", question, "Creator:", msg.sender);
        emit MatchMarketCreated(marketId, question, msg.sender);
    }

    // ================================================================
    // │                          Predict                             │
    // ================================================================

    /// @notice Make a prediction on a market.
    /// @param marketId The ID of the market.
    /// @param prediction The prediction (WIN, LOST or DRAW).
    function predictMatch(uint256 marketId, Prediction prediction) external payable {
        Market storage m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();
        if (msg.value == 0) revert InvalidAmount();

        // Validate enum (protects against ABI passing 255, etc.)
        if (uint8(prediction) > uint8(Prediction.DRAW)) revert InvalidOutcome();

        UserPrediction storage userPred = predictions[marketId][msg.sender];
        if (userPred.amount != 0) revert AlreadyPredicted();

        userPred.amount = msg.value;
        userPred.prediction = prediction;
        userPred.claimed = false;

        if (prediction == Prediction.WIN) {
            m.totalWinPool += msg.value;
        } else if (prediction == Prediction.LOST) {
            m.totalLostPool += msg.value;
        } else {
            m.totalDrawPool += msg.value;
        }

        emit PredictionMade(marketId, msg.sender, prediction, msg.value);
    }

    // ================================================================
    // │                    Request settlement                        │
    // ================================================================

    /// @notice Request settlement for a market.
    /// @dev Emits SettlementRequested event for CRE Log Trigger.
    /// @param marketId The ID of the market to settle.
    function requestSettlement(uint256 marketId) external {
        Market storage m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();

        emit SettlementRequested(marketId, m.question);
    }

    // ================================================================
    // │                 Market settlement by CRE                     │
    // ================================================================

    /// @notice Settles a market from a CRE report with AI-determined outcome.
    /// @dev Called via onReport → _processReport when prefix byte is 0x01.
    /// @param report ABI-encoded (uint256 marketId, Prediction outcome, uint16 confidence)
    function _settleMarket(bytes calldata report) internal {
        (uint256 marketId, Prediction outcome, uint16 confidence) =
            abi.decode(report, (uint256, Prediction, uint16));

        // Validate enum (protects against invalid bytes)
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

    // ================================================================
    // │                      CRE Entry Point                         │
    // ================================================================

    /// @inheritdoc ReceiverTemplate
    /// @dev Routes to either market creation or settlement based on prefix byte.
    ///      - No prefix → Create market (Day 1)
    ///      - Prefix 0x01 → Settle market (Day 2)
    function _processReport(bytes calldata report) internal override {
        if (report.length > 0 && report[0] == 0x01) {
            _settleMarket(report[1:]);
        } else {
            string memory question = abi.decode(report, (string));
            createMatchMarket(question);
        }
    }

    // ================================================================
    // │                      Claim winnings                          │
    // ================================================================

    /// @notice Claim winnings after market settlement.
    /// @param marketId The ID of the market.
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

        // If nobody bet the winning side, division by zero would happen.
        // You can change this rule if you want refunds instead.
        if (winningPool == 0) revert NothingToClaim();

        // Parimutuel payout: winners split the entire pool pro-rata.
        uint256 payout = (userPred.amount * totalPool) / winningPool;

        (bool success,) = msg.sender.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    // ================================================================
    // │                          Getters                             │
    // ================================================================

    /// @notice Get market details.
    /// @param marketId The ID of the market.
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /// @notice Get user's prediction for a market.
    /// @param marketId The ID of the market.
    /// @param user The user's address.
    function getPrediction(uint256 marketId, address user) external view returns (UserPrediction memory) {
        return predictions[marketId][user];
    }
}
