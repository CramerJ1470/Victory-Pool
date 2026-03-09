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

CRE CONTRACTS
	in contracts folder, create .env
	use this template:

###############################################################################
### REQUIRED ENVIRONMENT VARIABLES - SENSITIVE INFORMATION                  ###
### DO NOT STORE RAW SECRETS HERE IN PLAINTEXT IF AVOIDABLE                 ###
### DO NOT UPLOAD OR SHARE THIS FILE UNDER ANY CIRCUMSTANCES                ###
###############################################################################
# Ethereum private key or 1Password reference (e.g. op://vault/item/field)
CRE_ETH_PRIVATE_KEY=<Your Sepolia ethereum private key> remeber, only use wallets with test eth do not involve your real wallets out of security
# Default target used when --target flag is not specified (e.g. staging-settings, production-settings, my-target)
CRE_TARGET=staging-settings

# Gemini configuration: API Key
GEMINI_API_KEY_VAR=<Your Gemini API key>
PREDICTION_MARKET_ADDRESS=0xCf7099fA443f8a6722911a47994AedF5AFbadf541
SEP_ETH_API_KEY=<your Sepolia eth api key> allows verification of contracts
WLD_MARKET_ADDRESS=<Your MatchWLDMarketPrediction address after deployment>

# Victory Pool Token:
VPT=0x8c08f20d9020e5ff5e4A5Ed4dA2E61ED4a7857a7 



CRE WORKFLOW


TO START:
	deploy contract MatchWLDPredictionMarket.sol

	from you cre-victory-pool/contracts folder we will be working with Forge 

	To  install forge see:
	https://www.getfoundry.sh/introduction/installation

	at cre-victory-pool directory:
	
	```bash
	curl -L https://foundry.paradigm.xyz | bash
	
	# spin up foundry (to use forge commands)

	```bash
	foundryup
	

	# grab your enviromental variables
	```bash
	source .env
	

	# create you MatchWLDMarketPrediction contract and deploy
	```bash
	forge create src/MatchWLDPredictionMarket.sol:MatchWLDPredictionMarket   --rpc-url "https://ethereum-sepolia-rpc.publicnode.com"   --private-key $CRE_ETH_PRIVATE_KEY   --broadcast --constructor-args 0x15fc6ae953e024d975e77382eeec56a9101f9f88 $VPT
	```

	From terminal returned infoprmation copy and paste 'deployed to' address an add to .env file as WLD_MARKET_ADDRESS
	Add it to frontend .env, cre-victory-pool .env and root folder .env

	In your frontend/src/lib/addresses file change MATCH_WLD_MARKET_ADDRESS to your new contract address

	You will need to verify your contract if you are not using a deployment method that gives you access to it.

	To verify your contract from the bash line: 
  	You need a sepolia Etherscan Api Key and set it in .env as SEP_ETH_API_KEY
	run command to capture your env environement (check your path): source .env 
  
 	run command : forge verify-contract $WLD_MARKET_ADDRESS src/MatchWLDPredictionMarket.sol:MatchWLDPredictionMarket --chain sepolia   --etherscan-api-key $SEP_ETH_API_KEY

	

	Go to https://sepolia.etherscan.io/ and place you WLD_MARKET_ADDRESS in the tx search
	Click on contract tab and scroll down to ABI
	Copy and paste in your frontend/src/abi/MatchWLDPredictionMarketABI.json

___

## 📂 Create Prediction Market

Now we create prediction market for certain match: 

run workflow from cre-Victory-pool dir: cre workflow simulate ./match-wld-workflow --broadcast

  it will show: 🚀 Workflow simulation ready. Please select a trigger:
          1. http-trigger@1.0.0-alpha Trigger
          2. evm:ChainSelector:16015286601757825753@1.0.0 LogTrigger

          Enter your choice (1-2): 
          ** type: 1

  then this will show: 🔍 HTTP Trigger Configuration:
          Please provide JSON input for the HTTP trigger.
          You can enter a file path or JSON directly.

          Enter your input:
          ** Enter your question (later on app will handle this): 
          {"question":"Will Chelsea Win, Lost or Draw against Leeds United on 2026-02-10T19:30:00Z? enum=[WIN,LOST,DRAW]"}

          
  record the transaction hash: 

  check transaction hash on https://sepolia.etherscan.io/

  Under logs, you can see the marketId. If this is your first MatchCreated it will be 0.

## Get Market

	Lets getMarket: Note: on etherscan  you can see you transaction on the Market address contract and it will let you know the marketID which if this first on will be 0- this one is 1 for our example here

	run command: cast call $WLD_MARKET_ADDRESS "getMarket(uint256) returns ((address,uint48,uint48,bool,uint16,uint8,uint256,uint256,uint256,string))"   0  --rpc-url "https://ethereum-sepolia-rpc.publicnode.com"

	something like this will be returned: (0x15fC6ae953E024d975e77382eEeC56A9101f9F88, 1771265424 [1.771e9], 0, false, 0, 0, 0, 0, 0, "Will Chelsea Win, Lost or Drew against Leeds United on 2026-02-10T19:30:00Z enum=[WIN,LOST,`DRAW`]")

## Make a prediction

	First you must get approved for VPT (Victory Pool Token) in order to predict.
	This can happen once you've deployed the frontend and have requested under any match card to approve - and pick any amount up to your current holdings. 

	Let's make a prediction...

	here is function parameters for predicting- function predictMatchWithVPT(uint256 marketId, Prediction prediction, uint256 amount)
	You can see args are (marketID, what your predition is (WIN=0,LOST=1,DRAW=2), amount)
	
	Predictions:
	```bash
	cast send $MARKET_ADDRESS "predictMatchWithVPT(uint256,uint8,uint256)" 0 0 10 --rpc-url "https://ethereum-sepolia-rpc.publicnode.com" --private-key $CRE_ETH_PRIVATE_KEY
	```

	check you prediction on you WLD_MARKET_ADDRESS sepolis etherscaen - you will see predictMatchWithVPT

	lets get the market an see our prediction :

	```bash
	cast call $WLD_MARKET_ADDRESS "getMarket(uint256) returns ((address,uint48,uint48,bool,uint16,uint8,uint256,uint256,uint256,string))"   0  --rpc-url "https://ethereum-sepolia-rpc.publicnode.com"
	```

	returns something like this: 
	(0x15fC6ae953E024d975e77382eEeC56A9101f9F88, 1773022968 [1.773e9], 0, false, 0, 0, 10, 0, 0, "Will Chelsea Win, Lost or Draw against Leeds United on 2026-02-10T19:30:00Z? enum=[WIN,LOST,DRAW]")

	False show it has not been settled yet, then you have 10,0,0 (WIN,LOST,DRAW) and you bet win so it shows 10 in the WinPool position

	or, sheck you prediction: 

	```bash
	cast call $WLD_MARKET_ADDRESS "getPrediction(uint256,address) returns ((uint256,uint8,bool))" 0 <your wallet here> --rpc-url 
	"https://ethereum-sepolia-rpc.publicnode.com"
	
	___

	returns: (10, 0, false) 10- VPT bet, 0 = WIN, false =not claimed

	
## RequestSettlement

	Lets requestSettlement:
	run command: 
	```bash
	cast send $MARKET_ADDRESS "requestSettlement(uint256)"  0  --rpc-url "https://ethereum-sepolia-rpc.publicnode.com"   --private-key $CRE_ETH_PRIVATE_KEY
	```	
	record the transaction hash for the next step


## Settle Market with Gemini:

	Let's get settlement results using the Gemini AI:
  	run command: 

	```bash
	cre workflow simulate ./match-wld-workflow --broadcast
	

    it will show: Workflow simulation ready. Please select a trigger:
          1. http-trigger@1.0.0-alpha Trigger
          2. evm:ChainSelector:16015286601757825753@1.0.0 LogTrigger

          Enter your choice (1-2): 
          ** type: 2

  then this will show: 🔍 HTTP Trigger Configuration:
          🔗 EVM Trigger Configuration: 
          Please provide the transaction hash and event index for the EVM log event.
          Enter transaction hash (0x...):
          enter your requestSettlement transaction hash: <you requestsettlement transaction hash>

		  enter 0 for last prompt

Answer: "DRAW"

lets check the market now: 
```bash
cast call $WLD_MARKET_ADDRESS "getMarket(uint256) returns ((address,uint48,uint48,bool,uint16,uint8,uint256,uint256,uint256,string))"   0  --rpc-url "https://ethereum-sepolia-rpc.publicnode.com"
```

returns: (0x15fC6ae953E024d975e77382eEeC56A9101f9F88, 1773022968 [1.773e9], 1773026796 [1.773e9], true, 10000 [1e4], 2, 10, 0, 0, "Will Chelsea Win, Lost or Draw against Leeds United on 2026-02-10T19:30:00Z? enum=[WIN,LOST,DRAW]")

shows true= settled, 10000 = top confidence, 2 is result (DRAW) 10,0,0 are predictions WIN,LOST,DRAW





























This is simple Typescript workflow. It shows how to create "match-wld-workflow" workflow using Typescript.

Steps to run the example

## 1. Update .env file

You need to add a private key to env file. This is specifically required if you want to simulate chain writes. For that to work the key should be valid and funded.
If your workflow does not do any chain write then you can just put any dummy key as a private key. e.g.

```
CRE_ETH_PRIVATE_KEY=0000000000000000000000000000000000000000000000000000000000000001
```

Note: Make sure your `workflow.yaml` file is pointing to the config.json, example:

```yaml
staging-settings:
  user-workflow:
    workflow-name: "match-wld-workflow-staging"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.staging.json"
    secrets-path: "../secrets.yaml"
```

## 2. Install dependencies

If `bun` is not already installed, see https://bun.com/docs/installation for installing in your environment.

```bash
cd cre-victory-pool/match-wld-workflow
 && bun install
```

Example: For a workflow directory named `match-wld-worflow` the command would be:

```bash
cd match-wld-workflow && bun install
```

## 3. Simulate the workflow

Run the command from <b>project root directory</b>

```bash
cre workflow simulate <path-to-workflow-directory> --target=staging-settings
```

Example: For workflow named `match-wld-workflow` the command would be:

from cre-victory-pool folder

```bash
cre workflow simulate ./match-wld-workflow --target=staging-settings
```





📜 License

MIT License © 2026 SillyNFTier
