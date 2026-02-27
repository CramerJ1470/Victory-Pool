# ⚽ VICTORY-POOL  
### Sport Blockchain Prediction Platform

![Solidity](https://img.shields.io/badge/Solidity-0.8.20-black)
![Hardhat](https://img.shields.io/badge/Hardhat-Framework-yellow)
![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia_Testnet-purple)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-MVP-orange)
![Parimutuel](https://img.shields.io/badge/Betting-Parimutuel-blue)Victory-Pool

---

<p align="center">
  <img src="./assets/Victory-pool-logo.jpeg" alt="Victory-pool Logo" width="420"/>
</p>

---

## 🚀 Overview

**Victory-pool** is a decentralized sports prediction platform built on blockchain technology.  
It uses a **parimutuel betting model**, meaning all bets are pooled together and payouts are distributed proportionally among winners — **no house edge, fully transparent**.

Smart contracts handle:
- Bet pooling
- Outcome resolution
- Automated payouts

---

## 🧠 Key Features

- ⚖️ Parimutuel betting smart contracts  
- 🔐 Trustless & non-custodial  
- ⛓️ Ethereum-compatible (Sepolia / Mainnet-ready)  
- 💰 Token-based betting system  
- 🏟️ Multi-sport expandable architecture  

---

## 🏗️ Tech Stack

| Layer | Technology |
|-----|-----------|
| Smart Contracts | Solidity 0.8.x |
| Dev Framework | Hardhat |
| Blockchain | Ethereum (Sepolia) |
| Wallet | MetaMask |
| Frontend (optional) | React / Next.js |
| Tokens | ERC-20 |

---

## 📂 Project Structure

Victory-pool/
│
├── contracts/
│   ├── VPToken.sol
│   └── VictoryPool.sol
│
├── scripts/
│   └── deploy.js
│
├── test/
│   └── parimutuel.test.js
│
├── hardhat.config.js
├── package.json
└── README.md

---

## 🔧 Installation

```bash
git clone https://github.com/Cramerj1470/Victory-Pool.git
cd victoryPool
npm install

🔑 Environment Variables

Create a .env file:

SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_wallet_private_key

⚠️ Never commit your private key

⸻

🚀 Deploy Smart Contracts

Compile contracts:

bash
npx hardhat compile

Deploy to Sepolia:

npx hardhat run scripts/deploy.js --network sepolia

You will receive deployed contract addresses in the console.

⸻

🧪 Run Tests


npx hardhat test

🪙 Token Flow
	1.	User acquires Victory-pool tokens
	2.	Tokens are staked into a match pool
	3.	Match outcome is resolved
	4.	Winning pool is distributed automatically

⸻

🔮 Roadmap
	•	Frontend dApp
	•	Oracle integration (Chainlink)
	•	Live match feeds
	•	DAO governance
	•	Mainnet deployment

⸻

⚠️ Disclaimer

This project is for educational and experimental purposes.
Check local laws before deploying betting-related applications.

⸻
┌─────────────────────────────────────────────────────────────────────────┐
│                         PREDICTION MARKET FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CREATE MARKET                                                       │
│     App creates a market with a Yes/No question                      │
│     Example: "Will Liverpool beat Bournemouth on Wed Feb 11th, 2026?"                   │
│                                                                         │
│  2. PREDICT                                                             │
│     Users stake VPT on Yes or No                                        │
│     → Funds go into Yes Pool or No Pool                                 │
│                                                                         │
│  3. REQUEST SETTLEMENT                                                  │
│     Anyone can request settlement                                       │
│     → Emits SettlementRequested event                                   │
│     → CRE Log Trigger detects event                                     │
│     → CRE asks Gemini AI for the answer                                 │
│     → CRE writes outcome back via onReport()                            │
│                                                                         │
│  4. CLAIM WINNINGS                                                      │
│     Winners claim their share of the total pool                         │
│     → Your stake * (Total Pool / Winning Pool)                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘



📜 License

MIT License © 2026 SillyNFTier
