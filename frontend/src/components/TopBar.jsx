import { useEffect, useMemo, useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";

import { ADDRESSES } from "../lib/addresses";
import { VPTFaucetAbi } from "../abi/VPTFaucetAbi";

// Minimal ERC20 approve ABI (for LINK approve)
const ERC20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

export default function TopBar({ address, balance, chainName, onDisconnect }) {
  // --- Reads ---
  const claimed = useReadContract({
    address: ADDRESSES.FAUCET,
    abi: VPTFaucetAbi,
    functionName: "hasClaimed",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!ADDRESSES.FAUCET },
  });

  const ethPrice = useReadContract({
    address: ADDRESSES.FAUCET,
    abi: VPTFaucetAbi,
    functionName: "ethPriceWei",
    query: { enabled: !!ADDRESSES.FAUCET },
  });

  const linkPrice = useReadContract({
    address: ADDRESSES.FAUCET,
    abi: VPTFaucetAbi,
    functionName: "linkPriceWei",
    query: { enabled: !!ADDRESSES.FAUCET },
  });

  const hasClaimed = claimed.data === true;

  // --- Writes (we’ll track tx hash per action) ---
  const { writeContract } = useWriteContract();
  const [txHash, setTxHash] = useState(null);
  const [phase, setPhase] = useState(""); // "claim" | "buyEth" | "approveLink" | "buyLink"

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // After approveLink confirms, automatically call buy50WithLink
  useEffect(() => {
    if (!receipt.isSuccess) return;

    if (phase === "approveLink") {
      // next step: buy with link
      setPhase("buyLink");
      writeContract(
        {
          address: ADDRESSES.FAUCET,
          abi: VPTFaucetAbi,
          functionName: "buy50WithLink",
          args: [],
        },
        {
          onSuccess: (hash) => setTxHash(hash),
        }
      );
    }

    // After any completed tx (claim / buyEth / buyLink), refresh reads
    if (phase === "claim" || phase === "buyEth" || phase === "buyLink") {
      claimed.refetch?.();
    }
  }, [receipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = receipt.isLoading || receipt.isFetching;

  const statusText = useMemo(() => {
    if (!txHash) return "";
    if (receipt.isLoading) return "Confirming transaction...";
    if (receipt.isSuccess) return "Confirmed ✅";
    if (receipt.isError) return "Transaction failed ❌";
    return "";
  }, [txHash, receipt.isLoading, receipt.isSuccess, receipt.isError]);

  const onClaim = () => {
    setPhase("claim");
    writeContract(
      {
        address: ADDRESSES.FAUCET,
        abi: VPTFaucetAbi,
        functionName: "claim100",
        args: [],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
      }
    );
  };

  const onBuyWithEth = () => {
    const value = ethPrice.data ?? parseEther("0.001");
    setPhase("buyEth");
    writeContract(
      {
        address: ADDRESSES.FAUCET,
        abi: VPTFaucetAbi,
        functionName: "buy50WithEth",
        args: [],
        value,
      },
      {
        onSuccess: (hash) => setTxHash(hash),
      }
    );
  };

  const onBuyWithLink = () => {
    const amount = linkPrice.data ?? 1_000_000_000_000_000_000n; // 1 LINK fallback
    setPhase("approveLink");
    writeContract(
      {
        address: ADDRESSES.LINK,
        abi: ERC20ApproveAbi,
        functionName: "approve",
        args: [ADDRESSES.FAUCET, amount],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
      }
    );
  };

  const canUseFaucet = !!ADDRESSES.FAUCET;
  const canBuyLink = canUseFaucet && !!ADDRESSES.LINK;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Victory Pool</div>
          <div className="small">Network: {chainName}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="small">Wallet: {address}</div>
          <div className="small">VPT: {balance}</div>

          <div className="spacer" />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!hasClaimed ? (
              <button onClick={onClaim} disabled={!canUseFaucet || busy}>
                {busy && phase === "claim" ? "Claiming..." : "Get 100 VPT"}
              </button>
            ) : (
              <>
                <button onClick={onBuyWithEth} disabled={!canUseFaucet || busy}>
                  {busy && phase === "buyEth" ? "Buying..." : "Buy +50 VPT (ETH)"}
                </button>

                <button onClick={onBuyWithLink} disabled={!canBuyLink || busy}>
                  {busy && (phase === "approveLink" || phase === "buyLink")
                    ? "Buying..."
                    : "Buy +50 VPT (1 LINK)"}
                </button>
              </>
            )}

            <button onClick={onDisconnect} disabled={busy}>Disconnect</button>
          </div>

          <div className="spacer" />
          {!canUseFaucet ? (
            <div className="small">Set ADDRESSES.FAUCET to enable VPT claims.</div>
          ) : claimed.isLoading ? (
            <div className="small">Checking claim status...</div>
          ) : statusText ? (
            <div className="small">{statusText}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
