// src/components/MatchCard.jsx
import { useMemo, useState, useEffect, useRef } from "react";
import {
  formatUnits,
  parseUnits,
  decodeEventLog,
  parseAbiItem,
} from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useSignMessage,
} from "wagmi";

import VPTokenAbi from "../abi/VPToken.json";
import MatchWLDPredictionMarketArtifact from "../abi/MatchWLDPredictionMarketabi.json";

import { ADDRESSES, VPT_DECIMALS } from "../lib/addresses";
import cryptoclubmarketlist from "../data/cryptoclubmarketlist";

const MatchWLDPredictionMarketAbi = MatchWLDPredictionMarketArtifact.abi;

const MATCH_MARKET_ADMIN_WALLET_ADDRESS =
  import.meta.env.VITE_MATCH_MARKET_ADMIN_WALLET_ADDRESS;

// ✅ Separate Next/Vercel server base URL (Neon lives there)
// e.g. https://victorypool-server.vercel.app
const API_BASE = import.meta.env.VITE_API_BASE_URL;

function normAddr(addr) {
  return (addr || "").toLowerCase();
}

// --- helpers: normalize and lookup logos from cryptoclubmarketlist ---
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const codeNorm = (s) => String(s ?? "").toUpperCase().trim();

function getTeamMeta(teamLike) {
  const clubName = teamLike?.clubName ?? "";
  const matchCode = codeNorm(teamLike?.code);

  const byName = cryptoclubmarketlist.find(
    (x) => norm(x?.team?.name) === norm(clubName)
  );
  if (byName) return byName.team;

  const byPartialName = cryptoclubmarketlist.find((x) => {
    const a = norm(x?.team?.name);
    const b = norm(clubName);
    return a && b && (a.includes(b) || b.includes(a));
  });
  if (byPartialName) return byPartialName.team;

  const aliases = {
    BOU: ["BOR", "BOU"],
    NEW: ["NEW"],
    MCI: ["MNC", "MCI"],
    TOT: ["TOT"],
    EVE: ["EVR", "EVE"],
    LEE: ["LDU", "LEE"],
  };

  const possibleCodes = matchCode ? [matchCode, ...(aliases[matchCode] ?? [])] : [];

  const byCode = cryptoclubmarketlist.find((x) =>
    possibleCodes.includes(codeNorm(x?.team?.code))
  );
  if (byCode) return byCode.team;

  return null;
}

function TeamBlock({ team, align = "left" }) {
  const name = team?.clubName ?? "Unknown";
  const meta = getTeamMeta(team);
  const logo = meta?.logo;

  const wrapStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: align === "right" ? "flex-end" : "flex-start",
    textAlign: align === "right" ? "right" : "left",
    minWidth: 0,
  };

  const img = logo ? (
    <img
      src={logo}
      alt={`${name} logo`}
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        objectFit: "contain",
        background: "rgba(0,0,0,0.04)",
        padding: 6,
        border: "1px solid rgba(0,0,0,0.08)",
        flex: "0 0 auto",
      }}
      loading="lazy"
    />
  ) : null;

  const text = (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontWeight: 900,
          fontSize: 18,
          lineHeight: 1.1,
          color: "#111",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {name}
      </div>
      <div className="small" style={{ color: "rgba(0,0,0,0.62)" }}>
        #{team?.rank ?? "—"} • {team?.Pts ?? "—"} pts
      </div>
    </div>
  );

  return (
    <div style={wrapStyle}>
      {align === "right" ? (
        <>
          {text}
          {img}
        </>
      ) : (
        <>
          {img}
          {text}
        </>
      )}
    </div>
  );
}

// ✅ Browser SHA-256 hex (to match server's sha256 hex bodyHash)
async function sha256HexBrowser(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomNonce() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ✅ matches your server buildMessage() exactly
async function buildAdminMessage({ method, path, body, issuedAt, nonce }) {
  const bodyHash = await sha256HexBrowser(body || "");
  return [
    "VICTORY_POOL_ADMIN_REQUEST",
    `method:${method}`,
    `path:${path}`,
    `bodyHash:${bodyHash}`,
    `issuedAt:${issuedAt}`,
    `nonce:${nonce}`,
  ].join("\n");
}

function predLabel(n) {
  if (n === 0) return "WIN";
  if (n === 1) return "LOST";
  if (n === 2) return "DRAW";
  if (n !== 0 && n !== 1 && n !== 2) return "INCONCLUSIVE";
  return String(n);
}

/**
 * Props:
 * - match: match object (should include match.matchId once created)
 * - marketId: (optional legacy prop) fallback if match.matchId not present
 * - onMarketCreated: (match, marketIdString) => void   <-- parent updates matches state
 */
export default function MatchCard({ match, marketId, onMarketCreated }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();

  const home = match?.teams?.[0];
  const away = match?.teams?.[1];

  // Market ID should live on match.matchId
  const effectiveMarketId = match?.matchId ?? marketId ?? "";

  // ===== Admin detection =====
  const isAdmin = useMemo(() => {
    if (!address || !MATCH_MARKET_ADMIN_WALLET_ADDRESS) return false;
    return normAddr(address) === normAddr(MATCH_MARKET_ADMIN_WALLET_ADDRESS);
  }, [address]);

  // =====================================================================
  // ✅ Predict UI state (WIN / LOST / DRAW) with VPT
  // =====================================================================
  const [pick, setPick] = useState("WIN"); // WIN | LOST | DRAW
  const [amt, setAmt] = useState("10"); // VPT amount

  const predictionEnum = useMemo(() => {
    if (pick === "WIN") return 0;
    if (pick === "LOST") return 1;
    return 2; // DRAW
  }, [pick]);

  const amountWei = useMemo(() => {
    try {
      return parseUnits(amt || "0", VPT_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amt]);

  // ===== Read user's prediction (so we can switch to "Get My Bet") =====
  const predictionRead = useReadContract({
    address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
    abi: MatchWLDPredictionMarketAbi,
    functionName: "getPrediction",
    args:
      effectiveMarketId && address
        ? [BigInt(effectiveMarketId), address]
        : undefined,
    query: {
      enabled:
        !!ADDRESSES.MATCH_WLD_MARKET_ADDRESS &&
        !!effectiveMarketId &&
        !!address,
    },
  });

  const myPred = predictionRead.data;
  const myAmount = myPred?.amount ?? 0n;
  const alreadyPredicted = myAmount > 0n;

  // ===== Allowance read for VPT approve (spender = market contract) =====
  const allowance = useReadContract({
    address: ADDRESSES.VPT,
    abi: VPTokenAbi.abi,
    functionName: "allowance",
    args: address ? [address, ADDRESSES.MATCH_WLD_MARKET_ADDRESS] : undefined,
    query: { enabled: !!address && !!ADDRESSES.MATCH_WLD_MARKET_ADDRESS },
  });

  const allowanceOk = (allowance.data ?? 0n) >= amountWei && amountWei > 0n;

  // ===== Approve + Predict write =====
  const { writeContract } = useWriteContract();
  const [txHash, setTxHash] = useState(null);
  const [phase, setPhase] = useState(""); // "approve" | "predict"

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const busy = receipt.isLoading || receipt.isFetching;

  useEffect(() => {
    if (receipt.isSuccess && phase === "approve") {
      allowance.refetch?.();
    }
    if (receipt.isSuccess && phase === "predict") {
      predictionRead.refetch?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess, phase]);

  const onApprove = () => {
    setPhase("approve");
    writeContract(
      {
        address: ADDRESSES.VPT,
        abi: VPTokenAbi.abi,
        functionName: "approve",
        args: [ADDRESSES.MATCH_WLD_MARKET_ADDRESS, amountWei],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
        onError: (err) => {
          console.error(err);
          setTxHash(null);
          setPhase("");
        },
      }
    );
  };

  const onBet = () => {
    if (!effectiveMarketId) {
      console.error("Missing matchId/marketId for prediction.");
      return;
    }
    if (!ADDRESSES.MATCH_WLD_MARKET_ADDRESS) {
      console.error("Missing ADDRESSES.MATCH_WLD_MARKET_ADDRESS");
      return;
    }
    if (!allowanceOk) {
      console.error("Approve VPT first.");
      return;
    }
    if (alreadyPredicted) {
      console.error("Already predicted.");
      return;
    }

    setPhase("predict");
    writeContract(
      {
        address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
        abi: MatchWLDPredictionMarketAbi,
        functionName: "predictMatchWithVPT",
        args: [BigInt(effectiveMarketId), predictionEnum, amountWei],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
        onError: (err) => {
          console.error(err);
          setTxHash(null);
          setPhase("");
        },
      }
    );
  };

  const onGetMyBet = async () => {
    try {
      await predictionRead.refetch?.();
    } catch (e) {
      console.warn("getPrediction refetch failed:", e);
    }
  };

  const approveDisabled = busy || amountWei <= 0n || alreadyPredicted;
  const betDisabled =
    busy ||
    !allowanceOk ||
    !effectiveMarketId ||
    !isConnected ||
    !address ||
    chainId !== 11155111 ||
    amountWei <= 0n ||
    alreadyPredicted;

  // =====================================================================
  // DB: pull match row (to read request_settlement_hash + settled)
  // =====================================================================
  const [dbMatch, setDbMatch] = useState(null);
  const [dbLoadError, setDbLoadError] = useState("");

  const fetchDbMatch = async (id) => {
    if (!API_BASE) return;
    if (!id) return;

    try {
      setDbLoadError("");
      const res = await fetch(`${API_BASE}/api/matches/${id}`, { method: "GET" });
      if (res.status === 404) {
        setDbMatch(null);
        return;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`DB GET failed (${res.status}) ${t}`);
      }
      const data = await res.json();
      setDbMatch(data);
    } catch (e) {
      console.warn("fetchDbMatch failed:", e);
      setDbLoadError(e?.message || String(e));
    }
  };

  useEffect(() => {
    if (!effectiveMarketId) return;
    fetchDbMatch(effectiveMarketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMarketId]);

  // =====================================================================
  // Settlement status check: read logs + getMarket()
  // =====================================================================
  const [settlementRequestedOnchain, setSettlementRequestedOnchain] = useState(false);

  const marketRead = useReadContract({
    address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
    abi: MatchWLDPredictionMarketAbi,
    functionName: "getMarket",
    args: effectiveMarketId ? [BigInt(effectiveMarketId)] : undefined,
    query: { enabled: !!ADDRESSES.MATCH_WLD_MARKET_ADDRESS && !!effectiveMarketId },
  });

  const isSettledOnchain = marketRead.data?.settled === true;

  useEffect(() => {
    if (!publicClient) return;
    if (!ADDRESSES.MATCH_WLD_MARKET_ADDRESS) return;
    if (!effectiveMarketId) return;

    let cancelled = false;

    (async () => {
      try {
        const event = parseAbiItem(
          "event SettlementRequested(uint256 indexed marketId, string question)"
        );

        const logs = await publicClient.getLogs({
          address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
          event,
          args: { marketId: BigInt(effectiveMarketId) },
          fromBlock: 0n,
          toBlock: "latest",
        });

        if (!cancelled) setSettlementRequestedOnchain(logs.length > 0);
      } catch (e) {
        console.warn("SettlementRequested log check failed:", e);
        if (!cancelled) setSettlementRequestedOnchain(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicClient, effectiveMarketId]);

  // =====================================================================
  // ✅ NEW: Detect MarketSettled log (CRE settles after SettlementRequested)
  //     Then auto-write settlement tx hash + outcome/confidence to Neon (admin-signed)
  // =====================================================================
  const [marketSettledTxHash, setMarketSettledTxHash] = useState(null);
  const [marketSettledMeta, setMarketSettledMeta] = useState(null); // { outcome, confidence }

  useEffect(() => {
    if (!publicClient) return;
    if (!ADDRESSES.MATCH_WLD_MARKET_ADDRESS) return;
    if (!effectiveMarketId) return;

    let cancelled = false;

    (async () => {
      try {
        const event = parseAbiItem(
          "event MarketSettled(uint256 indexed marketId, uint8 outcome, uint16 confidence)"
        );

        const logs = await publicClient.getLogs({
          address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
          event,
          args: { marketId: BigInt(effectiveMarketId) },
          fromBlock: 0n,
          toBlock: "latest",
        });

        if (cancelled) return;

        if (logs.length > 0) {
          const last = logs[logs.length - 1];
          setMarketSettledTxHash(last.transactionHash);
          setMarketSettledMeta({
            outcome: Number(last.args?.outcome ?? 0),
            confidence: Number(last.args?.confidence ?? 0),
          });
        } else {
          setMarketSettledTxHash(null);
          setMarketSettledMeta(null);
        }
      } catch (e) {
        console.warn("MarketSettled log check failed:", e);
        if (!cancelled) {
          setMarketSettledTxHash(null);
          setMarketSettledMeta(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicClient, effectiveMarketId]);

  // auto PATCH DB once we detect settlement (admin only)
  useEffect(() => {
    if (!marketSettledTxHash) return;
    if (!API_BASE) return;
    if (!effectiveMarketId) return;
    if (!isAdmin) return;
    if (!isConnected || !address) return;

    // If your DB already has settledTxHash / settlement_tx_hash, don't spam PATCH
    const dbSettledHash =
      dbMatch?.settled_tx_hash ??
      dbMatch?.settledTxHash ??
      dbMatch?.settlement_tx_hash ??
      dbMatch?.settlementTxHash ??
      null;

    if (dbSettledHash) return;

    (async () => {
      try {
        const method = "PATCH";
        const path = `/api/matches/${effectiveMarketId}`;

        const bodyObj = {
          settled: true,
          status: "settled",
          settledTxHash: marketSettledTxHash,
          outcome: marketSettledMeta?.outcome ?? null,
          confidence: marketSettledMeta?.confidence ?? null,
        };

        const rawBody = JSON.stringify(bodyObj);
        const issuedAt = new Date().toISOString();
        const nonce = randomNonce();

        const adminMsg = await buildAdminMessage({
          method,
          path,
          body: rawBody,
          issuedAt,
          nonce,
        });

        const signature = await signMessageAsync({ message: adminMsg });

        const res = await fetch(`${API_BASE}${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            "x-admin-signature": signature,
            "x-admin-issued-at": issuedAt,
            "x-admin-nonce": nonce,
            "x-admin-path": path,
          },
          body: rawBody,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `PATCH ${path} failed (${res.status})`);
        }

        fetchDbMatch(effectiveMarketId);
      } catch (e) {
        console.error("Auto-save settlement to DB failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketSettledTxHash, marketSettledMeta, API_BASE, effectiveMarketId, isAdmin]);

  // ===== Request Settlement write =====
  const { writeContract: writeSettlement } = useWriteContract();
  const [settleTxHash, setSettleTxHash] = useState(null);

  const settleReceipt = useWaitForTransactionReceipt({
    hash: settleTxHash,
    query: { enabled: !!settleTxHash },
  });

  const settleBusy = settleReceipt.isLoading || settleReceipt.isFetching;

  const onRequestSettlement = () => {
    if (!effectiveMarketId) {
      console.error("Missing matchId/marketId for requestSettlement");
      return;
    }
    if (!ADDRESSES.MATCH_WLD_MARKET_ADDRESS) {
      console.error("Missing ADDRESSES.MATCH_WLD_MARKET_ADDRESS");
      return;
    }

    writeSettlement(
      {
        address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
        abi: MatchWLDPredictionMarketAbi,
        functionName: "requestSettlement",
        args: [BigInt(effectiveMarketId)],
      },
      {
        onSuccess: (hash) => setSettleTxHash(hash),
        onError: (err) => {
          console.error("requestSettlement error:", err);
          setSettleTxHash(null);
        },
      }
    );
  };

  useEffect(() => {
    if (!settleReceipt.isSuccess) return;
    setSettlementRequestedOnchain(true);
  }, [settleReceipt.isSuccess]);

  // =====================================================================
  // Admin: Create Market + Add2Database (manual DB insert)
  // =====================================================================
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [adminAnimatingIn, setAdminAnimatingIn] = useState(false);
  const modalCardRef = useRef(null);

  const suggestedQuestion = useMemo(() => {
    const h = home?.clubName ?? "Home";
    const a = away?.clubName ?? "Away";
    const dt = match?.dateTime ?? "";
    return `Will ${h} WIN, LOST or DRAW against ${a} on ${dt}? enum=[WIN, LOST, DRAW]`;
  }, [home?.clubName, away?.clubName, match?.dateTime]);

  const [adminQuestion, setAdminQuestion] = useState(suggestedQuestion);

  useEffect(() => {
    setAdminQuestion(suggestedQuestion);
  }, [suggestedQuestion]);

  useEffect(() => {
    if (!showAdminPopup) return;
    const t = setTimeout(() => setAdminAnimatingIn(true), 10);
    return () => clearTimeout(t);
  }, [showAdminPopup]);

  useEffect(() => {
    if (!showAdminPopup) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowAdminPopup(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAdminPopup]);

  useEffect(() => {
    if (!showAdminPopup) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev);
  }, [showAdminPopup]);

  const { writeContractAsync: writeAdminAsync } = useWriteContract();
  const [adminTxHash, setAdminTxHash] = useState(null);
  const [adminStatus, setAdminStatus] = useState("");

  const adminReceipt = useWaitForTransactionReceipt({
    hash: adminTxHash,
    query: { enabled: !!adminTxHash },
  });

  // Show Add2Database only after createMarket receipt succeeds, and hide after success
  const [createdMarketIdFromLogs, setCreatedMarketIdFromLogs] = useState("");
  const [dbStatus, setDbStatus] = useState("");
  const [dbBusy, setDbBusy] = useState(false);
  const [dbInserted, setDbInserted] = useState(false);

  useEffect(() => {
    if (dbMatch?.market_id || dbMatch?.marketId) {
      setDbInserted(true);
    }
  }, [dbMatch]);

  // After createMarket confirms, decode logs and store marketId in state (NO POST here)
  useEffect(() => {
    if (!adminReceipt.isSuccess) return;

    try {
      const logs = adminReceipt.data?.logs ?? [];
      let createdId = null;

      for (const l of logs) {
        try {
          const decoded = decodeEventLog({
            abi: MatchWLDPredictionMarketAbi,
            data: l.data,
            topics: l.topics,
          });

          if (decoded?.eventName === "MatchMarketCreated") {
            createdId = decoded.args?.marketId;
            break;
          }
        } catch {}
      }

      if (createdId === null || createdId === undefined) {
        setAdminStatus("✅ Market created, but couldn't read marketId from logs.");
        setCreatedMarketIdFromLogs("");
        setShowAdminPopup(false);
        setAdminAnimatingIn(false);
        return;
      }

      const createdIdStr = createdId.toString();
      setCreatedMarketIdFromLogs(createdIdStr);

      onMarketCreated?.(match, createdIdStr);

      setAdminStatus(`✅ Market created (ID: ${createdIdStr}).`);
      setDbStatus("");
      setDbInserted(false);
      setShowAdminPopup(false);
      setAdminAnimatingIn(false);

      fetchDbMatch(createdIdStr);
    } catch (e) {
      console.error("Failed to decode MatchMarketCreated:", e);
      setAdminStatus("✅ Market created, but decode failed.");
      setCreatedMarketIdFromLogs("");
      setShowAdminPopup(false);
      setAdminAnimatingIn(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminReceipt.isSuccess]);

  useEffect(() => {
    if (!adminTxHash) return;
    if (adminReceipt.isLoading) setAdminStatus("Confirming transaction...");
    if (adminReceipt.isError) setAdminStatus("❌ Transaction failed");
  }, [adminTxHash, adminReceipt.isLoading, adminReceipt.isError]);

  const onAdminCreateMarket = async () => {
    setAdminStatus("");
    setDbStatus("");
    setDbInserted(false);
    setCreatedMarketIdFromLogs("");
    setAdminTxHash(null);

    if (!isAdmin) {
      setAdminStatus("Not admin.");
      return;
    }

    if (!ADDRESSES.MATCH_WLD_MARKET_ADDRESS) {
      setAdminStatus("Set ADDRESSES.MATCH_WLD_MARKET_ADDRESS to enable market creation.");
      return;
    }

    if (!isConnected || !address) {
      setAdminStatus("Connect your wallet first.");
      return;
    }

    if (chainId !== 11155111) {
      setAdminStatus("Switch to Sepolia to create markets.");
      return;
    }

    const q = String(adminQuestion ?? "").trim();
    if (!q) {
      setAdminStatus("Enter a market question.");
      return;
    }

    // keep your behavior: passing a JSON string is fine (contract stores as string)
    const payload = JSON.stringify({ question: q });

    try {
      const hash = await writeAdminAsync({
        address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
        abi: MatchWLDPredictionMarketAbi,
        functionName: "createMatchMarket",
        args: [payload],
      });

      setAdminTxHash(hash);
      setAdminStatus("Transaction submitted...");
    } catch (err) {
      console.error("createMatchMarket error:", err);
      setAdminStatus(err?.shortMessage || err?.message || "Failed to submit tx.");
    }
  };

  // ✅ Manual insert match row (POST /api/matches)
  const add2Database = async () => {
    setDbStatus("");

    if (!isAdmin) {
      setDbStatus("Not admin.");
      return;
    }
    if (!API_BASE) {
      setDbStatus("Missing VITE_API_BASE_URL (server origin).");
      return;
    }
    if (!createdMarketIdFromLogs) {
      setDbStatus("No created marketId found from logs yet.");
      return;
    }
    if (!isConnected || !address) {
      setDbStatus("Connect your wallet first.");
      return;
    }

    const method = "POST";
    const path = "/api/matches";

    const bodyObj = {
      marketId: Number(createdMarketIdFromLogs),
      date: String(match?.date ?? ""),
      time: String(match?.time ?? ""),
      dateTime: String(match?.dateTime ?? ""),
      status: String(match?.status ?? ""),
      result: match?.result ?? null,
      teams: Array.isArray(match?.teams)
        ? match.teams.map((t) => ({ clubName: t.clubName }))
        : [],
      fixture: String(match?.fixture ?? ""),
      settled: Boolean(match?.settled ?? false),
      requestSettlementHash: match?.requestSettlementHash ?? null,
      createdAt: Number(match?.createdAt ?? Date.now()),
    };

    const rawBody = JSON.stringify(bodyObj);

    const issuedAt = new Date().toISOString();
    const nonce = randomNonce();

    try {
      setDbBusy(true);
      setDbStatus("Signing admin request...");

      const adminMsg = await buildAdminMessage({
        method,
        path,
        body: rawBody,
        issuedAt,
        nonce,
      });

      const signature = await signMessageAsync({ message: adminMsg });

      setDbStatus("Posting to database...");

      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-admin-signature": signature,
          "x-admin-issued-at": issuedAt,
          "x-admin-nonce": nonce,
          "x-admin-path": path,
        },
        body: rawBody,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `POST ${path} failed (${res.status})`);
      }

      setDbStatus("✅ Saved to Neon (matches table).");
      setDbInserted(true);
      fetchDbMatch(createdMarketIdFromLogs);
    } catch (e) {
      console.error("add2Database failed:", e);
      setDbStatus(`❌ DB save failed: ${e?.message || e}`);
    } finally {
      setDbBusy(false);
    }
  };

  // =====================================================================
  // Admin: add settlement request tx hash to DB (request_settlement_hash)
  // =====================================================================
  const [srDbStatus, setSrDbStatus] = useState("");
  const [srDbBusy, setSrDbBusy] = useState(false);
  const [srDbSaved, setSrDbSaved] = useState(false);

  useEffect(() => {
    const dbHash =
      dbMatch?.request_settlement_hash ??
      dbMatch?.requestSettlementHash ??
      null;

    if (dbHash) setSrDbSaved(true);
  }, [dbMatch]);

  const addSettlementHashToDatabase = async () => {
    setSrDbStatus("");

    if (!isAdmin) {
      setSrDbStatus("Not admin.");
      return;
    }
    if (!API_BASE) {
      setSrDbStatus("Missing VITE_API_BASE_URL (server origin).");
      return;
    }
    if (!effectiveMarketId) {
      setSrDbStatus("Missing marketId.");
      return;
    }
    if (!settleTxHash) {
      setSrDbStatus("Missing requestSettlement tx hash.");
      return;
    }
    if (!settleReceipt.isSuccess) {
      setSrDbStatus("Wait for the requestSettlement transaction to confirm first.");
      return;
    }
    if (!isConnected || !address) {
      setSrDbStatus("Connect your wallet first.");
      return;
    }

    const method = "PATCH";
    const path = `/api/matches/${effectiveMarketId}`;

    const bodyObj = {
      requestSettlementHash: settleTxHash,
      status: "settlement_requested",
    };
    const rawBody = JSON.stringify(bodyObj);

    const issuedAt = new Date().toISOString();
    const nonce = randomNonce();

    try {
      setSrDbBusy(true);
      setSrDbStatus("Signing admin request...");

      const adminMsg = await buildAdminMessage({
        method,
        path,
        body: rawBody,
        issuedAt,
        nonce,
      });

      const signature = await signMessageAsync({ message: adminMsg });

      setSrDbStatus("Updating database...");

      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-admin-signature": signature,
          "x-admin-issued-at": issuedAt,
          "x-admin-nonce": nonce,
          "x-admin-path": path,
        },
        body: rawBody,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `PATCH ${path} failed (${res.status})`);
      }

      setSrDbStatus("✅ Settlement request hash saved to DB.");
      setSrDbSaved(true);
      fetchDbMatch(effectiveMarketId);
    } catch (e) {
      console.error("addSettlementHashToDatabase failed:", e);
      setSrDbStatus(`❌ DB update failed: ${e?.message || e}`);
    } finally {
      setSrDbBusy(false);
    }
  };

  // =====================================================================
  // UI Logic
  // =====================================================================
  const canCreateMarket = isAdmin && !effectiveMarketId;

  const showAdd2DatabaseButton =
    isAdmin && adminReceipt.isSuccess && !!createdMarketIdFromLogs && !dbInserted;

  const showRequestSettlementButton =
    !!effectiveMarketId && !isSettledOnchain && !settlementRequestedOnchain;

  const showAddSRToDatabaseButton =
    isAdmin &&
    !!effectiveMarketId &&
    !isSettledOnchain &&
    settlementRequestedOnchain &&
    !!settleTxHash &&
    settleReceipt.isSuccess &&
    !srDbSaved;

  const dbSettled = dbMatch?.settled === true;

  const dbRequestHash =
    dbMatch?.request_settlement_hash ??
    dbMatch?.requestSettlementHash ??
    null;

  const showAdminSettleNote =
    isAdmin && !!effectiveMarketId && !!dbRequestHash && dbSettled === false;

  const showGetMyBet = alreadyPredicted;

  return (
    <>
      <div
        className="card"
        style={{
          width: "min(900px, 80vw)",
          background: "#b6b7b8",
          color: "#111",
          border: "1px solid rgba(0,0,0,0.10)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          margin: "auto",
        }}
      >
        {/* teams row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 14,
          }}
        >
          <TeamBlock team={home} align="left" />
          <div
            style={{
              fontWeight: 1000,
              fontSize: 16,
              padding: "8px 12px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.06)",
              color: "#111",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            VS
          </div>
          <TeamBlock team={away} align="right" />
        </div>

        <div style={{ height: 10 }} />

        <div className="small" style={{ textAlign: "center", color: "rgba(0,0,0,0.62)" }}>
          {match.fixture} • {match.date} {match.time} • {match.status}
          {effectiveMarketId ? (
            <>
              {" "}
              • Match:{" "}
              <span style={{ fontFamily: "monospace" }}>{String(effectiveMarketId)}</span>
            </>
          ) : null}
        </div>

        {/* Admin note about settling */}
        {showAdminSettleNote ? (
          <div
            className="small"
            style={{
              marginTop: 10,
              textAlign: "center",
              padding: "8px 10px",
              borderRadius: 12,
              background: "rgba(255, 200, 0, 0.22)",
              border: "1px solid rgba(0,0,0,0.12)",
              fontWeight: 800,
            }}
          >
            Admin please settle market {String(effectiveMarketId)}.
          </div>
        ) : null}

        {/* Market status line */}
        {effectiveMarketId ? (
          <div className="small" style={{ textAlign: "center", color: "rgba(0,0,0,0.65)", marginTop: 8 }}>
            {isSettledOnchain
              ? "Settled ✅"
              : settlementRequestedOnchain
              ? "Settlement Requested ✅ (CRE will settle)"
              : "Not settled"}
            {marketSettledTxHash ? " • MarketSettled ✅" : ""}
          </div>
        ) : null}

        <div className="spacer" />

        {/* Admin Create Market button */}
        {canCreateMarket ? (
          <div className="row" style={{ justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setShowAdminPopup(true);
                setAdminAnimatingIn(false);
                setAdminStatus("");
                setDbStatus("");
                setDbBusy(false);
                setDbInserted(false);
                setCreatedMarketIdFromLogs("");
                setAdminTxHash(null);
                setAdminQuestion(suggestedQuestion);
              }}
              style={{ fontWeight: 900 }}
            >
              Create Market
            </button>
          </div>
        ) : null}

        {/* ✅ Admin-only Add2Database button */}
        {showAdd2DatabaseButton ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
            <button
              onClick={add2Database}
              disabled={dbBusy}
              style={{ fontWeight: 900 }}
              title={!API_BASE ? "Set VITE_API_BASE_URL" : ""}
            >
              {dbBusy ? "Adding..." : "Add2Database"}
            </button>
          </div>
        ) : null}

        {/* ✅ Admin-only AddSRToDatabase button */}
        {showAddSRToDatabaseButton ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
            <button onClick={addSettlementHashToDatabase} disabled={srDbBusy} style={{ fontWeight: 900 }}>
              {srDbBusy ? "Saving..." : "addSRToDatabase"}
            </button>
          </div>
        ) : null}

        {isAdmin && (adminStatus || dbStatus || srDbStatus || dbLoadError) ? (
          <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, opacity: 0.9 }}>
            {adminStatus ? <div>{adminStatus}</div> : null}
            {dbStatus ? <div>{dbStatus}</div> : null}
            {srDbStatus ? <div>{srDbStatus}</div> : null}
            {dbLoadError ? <div style={{ opacity: 0.75 }}>DB load: {dbLoadError}</div> : null}
          </div>
        ) : null}

        <div className="spacer" />

        {/* ✅ Predict selection */}
        <div className="row" style={{ alignItems: "center" }}>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            disabled={alreadyPredicted}
          >
            <option value="WIN">Home WIN: {home?.clubName}</option>
            <option value="LOST">Home LOSE (Away WIN): {away?.clubName}</option>
            <option value="DRAW">DRAW</option>
          </select>

          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="Amount VPT"
            inputMode="decimal"
            style={{ flex: 1, minWidth: 180 }}
            disabled={alreadyPredicted}
          />
        </div>

        <div className="spacer" />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {!showGetMyBet ? (
            <>
              <button onClick={onApprove} disabled={approveDisabled}>
                {busy && phase === "approve" ? "Approving..." : "Approve VPT"}
              </button>

              <button
                onClick={onBet}
                disabled={betDisabled}
                title={
                  !effectiveMarketId
                    ? "Create a market first"
                    : !allowanceOk
                    ? "Approve first"
                    : alreadyPredicted
                    ? "Already predicted"
                    : ""
                }
              >
                {busy && phase === "predict" ? "Predicting..." : "Place Prediction"}
              </button>
            </>
          ) : (
            <button onClick={onGetMyBet} disabled={predictionRead.isFetching}>
              {predictionRead.isFetching ? "Loading..." : "Get My Bet"}
            </button>
          )}

          {/* Settlement request */}
          {showRequestSettlementButton ? (
            <button onClick={onRequestSettlement} disabled={settleBusy}>
              {settleBusy ? "Requesting..." : "Request Settlement"}
            </button>
          ) : (
            <button disabled style={{ opacity: 0.75, cursor: "not-allowed" }}>
              {isSettledOnchain ? "Settled ✅" : settlementRequestedOnchain ? "Settlement Requested ✅" : "Settlement Pending"}
            </button>
          )}
        </div>

        <div className="spacer" />

        <div className="small" style={{ color: "rgba(0,0,0,0.62)" }}>
          Allowance: {formatUnits(allowance.data ?? 0n, VPT_DECIMALS)} VPT
        </div>

        {/* approve/predict tx status */}
        {txHash ? (
          <div className="small" style={{ marginTop: 10, color: "rgba(0,0,0,0.72)" }}>
            {receipt.isLoading
              ? "Confirming transaction..."
              : receipt.isSuccess
              ? "Confirmed ✅"
              : receipt.isError
              ? "Transaction failed ❌"
              : null}
          </div>
        ) : null}

        {/* settlement request tx status */}
        {settleTxHash ? (
          <div className="small" style={{ marginTop: 10, color: "rgba(0,0,0,0.72)" }}>
            {settleReceipt.isLoading
              ? "Confirming settlement request..."
              : settleReceipt.isSuccess
              ? "Settlement requested ✅"
              : settleReceipt.isError
              ? "Settlement request failed ❌"
              : null}
          </div>
        ) : null}

        {/* MarketSettled box */}
        {marketSettledTxHash ? (
          <div
            className="small"
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.78)",
            }}
          >
            <div><b>Market Settled ✅</b></div>
            <div style={{ marginTop: 4 }}>
              Tx: <span style={{ fontFamily: "monospace" }}>{marketSettledTxHash}</span>
            </div>
            {marketSettledMeta ? (
              <div style={{ marginTop: 4 }}>
                Outcome: <b>{predLabel(marketSettledMeta.outcome)}</b> • Confidence:{" "}
                <b>{(marketSettledMeta.confidence ?? 0) / 100}%</b>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* My bet display */}
        {alreadyPredicted ? (
          <div
            className="small"
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.78)",
            }}
          >
            <div>
              <b>My Bet:</b>{" "}
              {formatUnits(myAmount, VPT_DECIMALS)} VPT on{" "}
              <b>{predLabel(Number(myPred?.prediction ?? -1))}</b>
              {myPred?.claimed ? " • Claimed ✅" : ""}
            </div>
          </div>
        ) : null}
      </div>

      {/* ===== Admin modal (unchanged) ===== */}
      {isAdmin && showAdminPopup && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowAdminPopup(false);
              setAdminAnimatingIn(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            opacity: adminAnimatingIn ? 1 : 0,
            transition: "opacity 160ms ease",
          }}
        >
          <div
            ref={modalCardRef}
            style={{
              width: "min(640px, 92vw)",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
              padding: 20,
              position: "relative",
              transform: adminAnimatingIn
                ? "translateY(0) scale(1)"
                : "translateY(8px) scale(0.99)",
              transition: "transform 160ms ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                Admin: Create Match Market
              </div>

              <button
                onClick={() => {
                  setShowAdminPopup(false);
                  setAdminAnimatingIn(false);
                }}
                aria-label="Close"
                title="Close"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.03)",
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 900,
                  lineHeight: "34px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
              Suggested question auto-filled for this match. Press <b>Esc</b> or click outside to close.
            </div>

            <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
              Market question
            </label>

            <textarea
              value={adminQuestion}
              onChange={(e) => setAdminQuestion(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                resize: "vertical",
                outline: "none",
              }}
              autoFocus
            />

            <button
              onClick={onAdminCreateMarket}
              disabled={!ADDRESSES.MATCH_WLD_MARKET_ADDRESS || adminReceipt.isLoading}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {adminReceipt.isLoading ? "Creating..." : "Create Market"}
            </button>

            {adminStatus ? (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                {adminStatus}
              </div>
            ) : null}

            {adminTxHash ? (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Tx: <span style={{ fontFamily: "monospace" }}>{adminTxHash}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}