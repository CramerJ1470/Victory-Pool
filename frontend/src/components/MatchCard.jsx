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
} from "wagmi";

import VPTokenAbi from "../abi/VPToken.json";
import VictoryPoolAbi from "../abi/VictoryPool.json";
import MatchWLDPredictionMarketArtifact from "../abi/MatchWLDPredictionMarketabi.json";

import { ADDRESSES, VPT_DECIMALS } from "../lib/addresses";
import cryptoclubmarketlist from "../data/cryptoclubmarketlist";

const MatchWLDPredictionMarketAbi = MatchWLDPredictionMarketArtifact.abi;

const MATCH_MARKET_ADMIN_WALLET_ADDRESS =
  import.meta.env.VITE_MATCH_MARKET_ADMIN_WALLET_ADDRESS;

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

  const byName = cryptoclubmarketlist.find((x) => norm(x?.team?.name) === norm(clubName));
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

  const byCode = cryptoclubmarketlist.find((x) => possibleCodes.includes(codeNorm(x?.team?.code)));
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

  const home = match?.teams?.[0];
  const away = match?.teams?.[1];

  // Market ID should live on match.matchId
  const effectiveMarketId = match?.matchId ?? marketId ?? "";

  // ===== Admin detection =====
  const isAdmin = useMemo(() => {
    if (!address || !MATCH_MARKET_ADMIN_WALLET_ADDRESS) return false;
    return normAddr(address) === normAddr(MATCH_MARKET_ADMIN_WALLET_ADDRESS);
  }, [address]);

  // ===== Bet UI state =====
  const [pick, setPick] = useState("home");
  const [amt, setAmt] = useState("10");

  const amountWei = useMemo(() => {
    try {
      return parseUnits(amt || "0", VPT_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amt]);

  // ===== Allowance read for VPT approve =====
  const allowance = useReadContract({
    address: ADDRESSES.VPT,
    abi: VPTokenAbi.abi,
    functionName: "allowance",
    args: address ? [address, ADDRESSES.POOL] : undefined,
    query: { enabled: !!address },
  });

  const allowanceOk = (allowance.data ?? 0n) >= amountWei && amountWei > 0n;

  // ===== Approve + Bet write =====
  const { writeContract } = useWriteContract();
  const [txHash, setTxHash] = useState(null);
  const [phase, setPhase] = useState(""); // "approve" | "bet"

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const busy = receipt.isLoading || receipt.isFetching;

  useEffect(() => {
    if (receipt.isSuccess && phase === "approve") {
      allowance.refetch?.();
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
        args: [ADDRESSES.POOL, amountWei],
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
      console.error("Missing matchId/marketId for betting.");
      return;
    }
    const side = pick === "home";
    setPhase("bet");
    writeContract(
      {
        address: ADDRESSES.POOL,
        abi: VictoryPoolAbi.abi,
        functionName: "placeBet",
        args: [BigInt(effectiveMarketId), side, amountWei],
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

  const approveDisabled = busy || amountWei <= 0n;
  const betDisabled = busy || !allowanceOk || !effectiveMarketId;

  // =====================================================================
  // Settlement status check (NO CONTRACT CHANGES): read logs + getMarket()
  // =====================================================================
  const [settlementRequested, setSettlementRequested] = useState(false);

  const marketRead = useReadContract({
    address: ADDRESSES.MATCH_WLD_MARKET_ADDRESS,
    abi: MatchWLDPredictionMarketAbi,
    functionName: "getMarket",
    args: effectiveMarketId ? [BigInt(effectiveMarketId)] : undefined,
    query: { enabled: !!ADDRESSES.MATCH_WLD_MARKET_ADDRESS && !!effectiveMarketId },
  });

  const isSettled = marketRead.data?.settled === true;

  // Pull SettlementRequested logs for this marketId
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
          fromBlock: 0n, // simplest; later you can optimize with a deployment block
          toBlock: "latest",
        });

        if (!cancelled) setSettlementRequested(logs.length > 0);
      } catch (e) {
        console.warn("SettlementRequested log check failed:", e);
        if (!cancelled) setSettlementRequested(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicClient, effectiveMarketId]);

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

  // After requestSettlement confirms, refresh the log-based status
  useEffect(() => {
    if (!settleReceipt.isSuccess) return;
    setSettlementRequested(true);
  }, [settleReceipt.isSuccess]);

  // =====================================================================
  // Admin: Create Market modal (your existing logic, unchanged)
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

  const onBackdropMouseDown = (e) => {
    if (!modalCardRef.current) return;
    if (e.target === e.currentTarget) {
      setShowAdminPopup(false);
      setAdminAnimatingIn(false);
    }
  };

  const { writeContractAsync: writeAdminAsync } = useWriteContract();
  const [adminTxHash, setAdminTxHash] = useState(null);
  const [adminStatus, setAdminStatus] = useState("");

  const adminReceipt = useWaitForTransactionReceipt({
    hash: adminTxHash,
    query: { enabled: !!adminTxHash },
  });

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
        setShowAdminPopup(false);
        setAdminAnimatingIn(false);
        return;
      }

      const createdIdStr = createdId.toString();
      setAdminStatus(`✅ Market created (ID: ${createdIdStr})`);

      onMarketCreated?.(match, createdIdStr);

      setShowAdminPopup(false);
      setAdminAnimatingIn(false);
    } catch (e) {
      console.error("Failed to decode MatchMarketCreated:", e);
      setAdminStatus("✅ Market created, but decode failed.");
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

  const canCreateMarket = isAdmin && !effectiveMarketId;

  // =====================================================================
  // ✅ Settlement button logic you asked for (without contract changes)
  // =====================================================================
  const showRequestSettlementButton =
    !!effectiveMarketId && !isSettled && !settlementRequested;

  const showSettleMarketButton =
    !!effectiveMarketId && !isSettled && settlementRequested;

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
      • Match: <span style={{ fontFamily: "monospace" }}>{String(effectiveMarketId)}</span>
    </>
  ) : null}
</div>

        <div className="spacer" />

        {/* Admin Create Market button */}
        {canCreateMarket ? (
          <div className="row" style={{ justifyContent: "center" }}>
            <button
              onClick={() => {
                setShowAdminPopup(true);
                setAdminAnimatingIn(false);
                setAdminStatus("");
                setAdminTxHash(null);
                setAdminQuestion(suggestedQuestion);
              }}
              style={{ fontWeight: 900 }}
            >
              Create Market
            </button>
          </div>
        ) : effectiveMarketId ? (
          <div className="small" style={{ textAlign: "center", color: "rgba(0,0,0,0.65)" }}>
            Market ID:{" "}
            <span style={{ fontFamily: "monospace" }}>{String(effectiveMarketId)}</span>
            {isSettled ? " • Settled ✅" : settlementRequested ? " • Settlement Requested ✅" : ""}
          </div>
        ) : null}

        <div className="spacer" />

        <div className="row" style={{ alignItems: "center" }}>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          >
            <option value="home">Home wins: {home?.clubName}</option>
            <option value="away">Away wins: {away?.clubName}</option>
          </select>

          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="Amount VPT"
            inputMode="decimal"
            style={{ flex: 1, minWidth: 180 }}
          />
        </div>

        <div className="spacer" />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
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
                : ""
            }
          >
            {busy && phase === "bet" ? "Betting..." : "Place Bet"}
          </button>

          {/* ✅ Requested: swap button based on whether SettlementRequested already happened */}
          {showRequestSettlementButton ? (
            <button
              onClick={onRequestSettlement}
              disabled={settleBusy}
              title={!effectiveMarketId ? "Create a market first" : ""}
            >
              {settleBusy ? "Requesting..." : "Request Settlement"}
            </button>
          ) : showSettleMarketButton ? (
            <button
              disabled
              title="Settlement has been requested. CRE will settle via onReport when ready."
              style={{ opacity: 0.75, cursor: "not-allowed" }}
            >
              Settle Market (CRE)
            </button>
          ) : (
            <button disabled style={{ opacity: 0.75, cursor: "not-allowed" }}>
              {isSettled ? "Settled ✅" : "Settlement Pending"}
            </button>
          )}
        </div>

        <div className="spacer" />

        <div className="small" style={{ color: "rgba(0,0,0,0.62)" }}>
          Allowance: {formatUnits(allowance.data ?? 0n, VPT_DECIMALS)} VPT
        </div>

        {/* approve/bet tx status */}
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

        {/* settlement tx status */}
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

