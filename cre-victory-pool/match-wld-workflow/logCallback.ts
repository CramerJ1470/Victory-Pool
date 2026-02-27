
import {
  cre,
  type Runtime,
  type EVMLog,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
} from "viem";
import { askGemini } from "../match-wld-workflow/gemini";

// Config type (matches config.staging.json structure)
type Config = {
  geminiModel: string;
  evms: Array<{
    marketAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

type Outcome = "WIN" | "LOST" | "DRAW";
interface GeminiResult {
  result: Outcome | "INCONCLUSIVE";
  confidence: number; // 0-10000
}

// Must match Solidity Market struct order returned by getMarket()
interface Market {
  creator: `0x${string}`;
  createdAt: bigint;     // uint48 decoded as bigint by viem
  settledAt: bigint;     // uint48 decoded as bigint by viem
  settled: boolean;
  confidence: number;    // uint16 decoded as number
  outcome: number;       // uint8 decoded as number
  totalWinPool: bigint;
  totalLostPool: bigint;
  totalDrawPool: bigint;
  question: string;
}

// ===========================
// Contract ABIs
// ===========================

const EVENT_ABI = parseAbi([
  "event SettlementRequested(uint256 indexed marketId, string question)",
]);

const GET_MARKET_ABI = [
  {
    name: "getMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "createdAt", type: "uint48" },
          { name: "settledAt", type: "uint48" },
          { name: "settled", type: "bool" },
          { name: "confidence", type: "uint16" },
          { name: "outcome", type: "uint8" },
          { name: "totalWinPool", type: "uint256" },
          { name: "totalLostPool", type: "uint256" },
          { name: "totalDrawPool", type: "uint256" },
          { name: "question", type: "string" },
        ],
      },
    ],
  },
] as const;

// (uint256 marketId, uint8 outcome, uint16 confidence)
const SETTLEMENT_PARAMS = parseAbiParameters(
  "uint256 marketId, uint8 outcome, uint16 confidence"
);

const outcomeMap: Record<Outcome, number> = {
  WIN: 0,
  LOST: 1,
  DRAW: 2,
};

// ===========================
// Log Trigger Handler
// ===========================

export function onLogTrigger(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Log Trigger - Settle Market");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // Step 1: Decode event log
    const topics = log.topics.map((t: Uint8Array) => bytesToHex(t)) as [
      `0x${string}`,
      ...`0x${string}`[]
    ];
    const data = bytesToHex(log.data);

    const decodedLog = decodeEventLog({ abi: EVENT_ABI, data, topics });
    const marketId = decodedLog.args.marketId as bigint;
    const question = decodedLog.args.question as string;

    runtime.log(`[Step 1] Settlement requested for Market #${marketId}`);
    runtime.log(`[Step 1] Question: "${question}"`);

    // Step 2: Read market details (EVM Read)
    runtime.log("[Step 2] Reading market details from contract...");

    const evmConfig = runtime.config.evms[0];
    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: evmConfig.chainSelectorName,
      isTestnet: true,
    });

    if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

    const callData = encodeFunctionData({
      abi: GET_MARKET_ABI,
      functionName: "getMarket",
      args: [marketId],
    });

    const readResult = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: evmConfig.marketAddress,
          data: callData,
        }),
      })
      .result();

    // decodeFunctionResult returns outputs array
const decoded = decodeFunctionResult({
  abi: GET_MARKET_ABI,
  functionName: "getMarket",
  data: bytesToHex(readResult.data),
}) as unknown;

const market = (Array.isArray(decoded) ? decoded[0] : decoded) as Market;



    runtime.log(`[Step 2] Market creator: ${market.creator}`);
    runtime.log(`[Step 2] Already settled: ${market.settled}`);
    runtime.log(`[Step 2] Win Pool: ${market.totalWinPool.toString()}`);
    runtime.log(`[Step 2] Lost Pool: ${market.totalLostPool.toString()}`);
    runtime.log(`[Step 2] DRAW Pool: ${market.totalDrawPool.toString()}`);

    if (market.settled) {
      runtime.log("[Step 2] Market already settled, skipping...");
      return "Market already settled";
    }

    // Step 3: Query Gemini
    runtime.log("[Step 3] Querying Gemini AI...");

    const geminiResult = askGemini(runtime, question);

    const jsonMatch = geminiResult.geminiResponse.match(
      /\{[\s\S]*"result"[\s\S]*"confidence"[\s\S]*\}/
    );
    if (!jsonMatch) {
      throw new Error(`Could not find JSON in AI response: ${geminiResult.geminiResponse}`);
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiResult;

    if (!["WIN", "LOST", "DRAW"].includes(parsed.result)) {
      throw new Error(
        `Cannot settle: AI returned ${parsed.result}. Only Win, LOST, or DRAW can settle a market.`
      );
    }
    if (parsed.confidence < 0 || parsed.confidence > 10000) {
      throw new Error(`Invalid confidence: ${parsed.confidence}`);
    }

    runtime.log(`[Step 3] AI Result: ${parsed.result}`);
    runtime.log(`[Step 3] AI Confidence: ${parsed.confidence / 100}%`);

    const outcomeValue = outcomeMap[parsed.result as Outcome];

    // Step 4: Write settlement report (EVM Write)
    runtime.log("[Step 4] Generating settlement report...");

    const settlementData = encodeAbiParameters(SETTLEMENT_PARAMS, [
      marketId,
      outcomeValue,
      parsed.confidence,
    ]);

    // Prefix byte 0x01 for settlement path
    const reportData = ("0x01" + settlementData.slice(2)) as `0x${string}`;

    const reportResponse = runtime
      .report({
        encodedPayload: hexToBase64(reportData),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();

    runtime.log(`[Step 4] Writing to contract: ${evmConfig.marketAddress}`);

    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: evmConfig.marketAddress,
        report: reportResponse,
        gasConfig: {
          gasLimit: evmConfig.gasLimit,
        },
      })
      .result();

    if (writeResult.txStatus === TxStatus.SUCCESS) {
      const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
      runtime.log(`[Step 4] ✓ Settlement successful: ${txHash}`);
      runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return `Settled: ${txHash}`;
    }

    throw new Error(`Transaction failed: ${writeResult.txStatus}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] ${msg}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw err;
  }
}
