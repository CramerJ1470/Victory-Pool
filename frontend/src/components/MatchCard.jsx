import { useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

import VPTokenAbi from "../abi/VPToken.json";
import VictoryPoolAbi from "../abi/VictoryPool.json";
import { ADDRESSES, VPT_DECIMALS } from "../lib/addresses";

export default function MatchCard({ match, marketId }) {
  const { address } = useAccount();
  const [pick, setPick] = useState("home"); // home or away
  const [amt, setAmt] = useState("10");

  const amountWei = useMemo(() => {
    try { return parseUnits(amt || "0", VPT_DECIMALS); }
    catch { return 0n; }
  }, [amt]);

  const allowance = useReadContract({
    address: ADDRESSES.VPT,
    abi: VPTokenAbi.abi,
    functionName: "allowance",
    args: address ? [address, ADDRESSES.POOL] : undefined,
    query: { enabled: !!address },
  });

  const allowanceOk = (allowance.data ?? 0n) >= amountWei && amountWei > 0n;

  const approve = useWriteContract();
  const placeBet = useWriteContract();

  const home = match.teams[0];
  const away = match.teams[1];

  const onApprove = async () => {
    await approve.writeContractAsync({
      address: ADDRESSES.VPT,
      abi: VPTokenAbi.abi,
      functionName: "approve",
      args: [ADDRESSES.POOL, amountWei],
    });
  };

  // IMPORTANT:
  // Your VictoryPool takes (uint256 marketId, bool side, uint256 amount)
  // We'll map "home win" => side=true, "away win" => side=false
  const onBet = async () => {
    const side = pick === "home";
    await placeBet.writeContractAsync({
      address: ADDRESSES.POOL,
      abi: VictoryPoolAbi.abi,
      functionName: "placeBet",
      args: [BigInt(marketId), side, amountWei],
    });
  };

  return (
    <div className="card">
      <div style={{ fontWeight: 800, fontSize: 16 }}>
        {home.clubName} vs {away.clubName}
      </div>
      <div className="small">{match.fixture} • {match.date} {match.time} • {match.status}</div>

      <div className="spacer" />

      <div className="row">
        <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
          <option value="home">Home wins: {home.clubName}</option>
          <option value="away">Away wins: {away.clubName}</option>
        </select>
        <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Amount VPT" style={{ flex: 1 }} />
      </div>

      <div className="spacer" />

      <div className="row">
        <button onClick={onApprove} disabled={approve.isPending || amountWei <= 0n}>
          {approve.isPending ? "Approving..." : "Approve VPT"}
        </button>

        <button
          onClick={onBet}
          disabled={!allowanceOk || placeBet.isPending}
          title={!allowanceOk ? "Approve first" : ""}
        >
          {placeBet.isPending ? "Betting..." : "Place Bet"}
        </button>
      </div>

      <div className="spacer" />
      <div className="small">
        Allowance: {formatUnits(allowance.data ?? 0n, VPT_DECIMALS)} VPT
      </div>
    </div>
  );
}
