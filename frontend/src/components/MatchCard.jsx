// src/components/MatchCard.jsx
import { useMemo, useState, useEffect } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import VPTokenAbi from "../abi/VPToken.json";
import VictoryPoolAbi from "../abi/VictoryPool.json";
import { ADDRESSES, VPT_DECIMALS } from "../lib/addresses";
import cryptoclubmarketlist from "../data/cryptoclubmarketlist";

// --- helpers: normalize and lookup logos from cryptoclubmarketlist ---
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const codeNorm = (s) => String(s ?? "").toUpperCase().trim();

function getTeamMeta(teamLike) {
  // teamLike is your match team object: { clubName, code?, ... }
  const clubName = teamLike?.clubName ?? "";
  const matchCode = codeNorm(teamLike?.code);

  // 1) Exact-ish name match (normalized)
  const byName = cryptoclubmarketlist.find(
    (x) => norm(x?.team?.name) === norm(clubName)
  );
  if (byName) return byName.team;

  // 2) Partial name match (handles "Newcastle United" vs "Newcastle")
  const byPartialName = cryptoclubmarketlist.find((x) => {
    const a = norm(x?.team?.name);
    const b = norm(clubName);
    return a && b && (a.includes(b) || b.includes(a));
  });
  if (byPartialName) return byPartialName.team;

  // 3) Code match (with common aliasing)
  // Your list has Bournemouth code "BOR" but your matches use "BOU".
  const aliases = {
    BOU: ["BOR", "BOU"],
    NEW: ["NEW"],
    MCI: ["MNC", "MCI"],
    TOT: ["TOT"],
    EVE: ["EVR", "EVE"],
    LEE: ["LDU", "LEE"],
  };

  const possibleCodes = matchCode
    ? [matchCode, ...(aliases[matchCode] ?? [])]
    : [];

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

export default function MatchCard({ match, marketId }) {
  const { address } = useAccount();
  const [pick, setPick] = useState("home");
  const [amt, setAmt] = useState("10");

  const amountWei = useMemo(() => {
    try {
      return parseUnits(amt || "0", VPT_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amt]);

  const allowance = useReadContract({
    address: ADDRESSES.VPT,
    abi: VPTokenAbi.abi,
    functionName: "allowance",
    args: address ? [address, ADDRESSES.POOL] : undefined,
    query: { enabled: !!address },
  });

  const allowanceOk = (allowance.data ?? 0n) >= amountWei && amountWei > 0n;

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
  }, [receipt.isSuccess, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const home = match?.teams?.[0];
  const away = match?.teams?.[1];

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
    const side = pick === "home";
    setPhase("bet");
    writeContract(
      {
        address: ADDRESSES.POOL,
        abi: VictoryPoolAbi.abi,
        functionName: "placeBet",
        args: [BigInt(marketId), side, amountWei],
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
  const betDisabled = busy || !allowanceOk;

  return (
    <div
      className="card"
      style={{
        width: "min(900px, 80vw)",
        background:  "#b6b7b8",
        color: "#111",
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        margin: "auth"
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
      </div>

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

      <div className="row">
        <button onClick={onApprove} disabled={approveDisabled}>
          {busy && phase === "approve" ? "Approving..." : "Approve VPT"}
        </button>

        <button
          onClick={onBet}
          disabled={betDisabled}
          title={!allowanceOk ? "Approve first" : ""}
        >
          {busy && phase === "bet" ? "Betting..." : "Place Bet"}
        </button>
      </div>

      <div className="spacer" />

      <div className="small" style={{ color: "rgba(0,0,0,0.62)" }}>
        Allowance: {formatUnits(allowance.data ?? 0n, VPT_DECIMALS)} VPT
      </div>

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
    </div>
  );
}

