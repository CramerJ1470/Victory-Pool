# ⚽ VICTORY-POOL  
### Sport Blockchain Prediction Platform

![Solidity](https://img.shields.io/badge/Solidity-0.8.20-black)
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

SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=your_wallet_private_key

**Victory Pool Token (VPT) addresses

VPT=0x8c08f20d9020e5ff5e4A5Ed4dA2E61ED4a7857a7
Registry=0x3a44190c234E731Fb7bdDE9DF7EFb52AEAfDe58a
VictoryPool=0x3277FD48B17193F8A0D278145Db10550dc539571
VPTFaucet=0x9A47CCBf7FE67818DF2443560a68B7A69a346430

⚠️Never commit your private key

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
	•	CRE integration (Chainlink) 
	•	Live match feeds
	•	DAO governance
	•	Mainnet deployment

⸻

⚠️ Disclaimer

This project is for educational and experimental purposes.
Check local laws before deploying betting-related applications.

⸻
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                         	VICTORY POOL FRONTEND FLOW				                        │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                         					│
│  1. CREATE MARKET  ( Admin only )                                                   		│
│     App creates a market with a Yes/No question( h - home team, a - away team, dt= date ) │
│     Example: "Will ${h} WIN, LOST or DRAW against ${a} on ${dt}? enum=[WIN, LOST, DRAW]"  │
│                                                                                           │
│  2. APPROVE ( Admin and users ) - to be used for predictions               				│
│     All new Users recieve 100 VPT on initial wallet connect (Metamask)               		│
│     VPT approved balance is for all predictions. Users can purchase additional VPT 		│
│		with LINK token or Sepolia_ETH	                                 					│
│                                                                                           │
│  3. PREDICT ( Admin and users )                                          					│
│     Users stake VPT on using pull down menu on Home team side for three options      		│
│     amount of stake default is 10 but can be changed in the inout field  					│
│     → Funds go into WIN Pool, LOST Pool, or DRAW pool ( based on home team )				│
│                                                                         					│
│  4. REQUEST SETTLEMENT  ( Admin or Users )                               					│
│     Anyone can request settlement                                       					│
│     → Emits SettlementRequested event                                   					│
│     → CRE Log Trigger detects event ( in simulation this step is maunual with Forge		│
│     → CRE asks Gemini AI for the answer                                 					│
│     → CRE writes outcome back via onReport()                           					│
│                                                                         					│
│                                                                         					│
│                                                                         					│
│                                                                         					│
│  4. CLAIM WINNINGS                                                      					│
│     Winners claim their share of the total pool                         					│
│     → Your stake * (Total Pool / Winning Pool)                          					│
│                                                                        					│
└───────────────────────────────────────────────────────────────────────────────────────────┘



📜 License

MIT License © 2026 SillyNFTier
