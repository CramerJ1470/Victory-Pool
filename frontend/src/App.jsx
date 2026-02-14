import { useMemo } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useSwitchChain, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { sepolia } from "wagmi/chains";

import Landing from "./components/Landing";
import TopBar from "./components/TopBar";
import MatchCard from "./components/MatchCard";

import matchesJson from "./data/upcomingMatches.json";
import VPTokenAbi from "./abi/VPToken.json";
import { ADDRESSES, VPT_DECIMALS } from "./lib/addresses";

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const needsSepolia = isConnected && chainId !== sepolia.id;

  const balance = useReadContract({
    address: ADDRESSES.VPT,
    abi: VPTokenAbi.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const balanceFmt = useMemo(() => {
    return formatUnits(balance.data ?? 0n, VPT_DECIMALS);
  }, [balance.data]);

  if (!isConnected || needsSepolia) {
    return (
      <Landing
        onConnect={() => connect({ connector: connectors[0] })}
        connecting={connecting}
        needsSepolia={needsSepolia}
        onSwitch={() => switchChainAsync({ chainId: sepolia.id })}
      />
    );
  }

  const matches = matchesJson.upcomingMatches ?? [];

  return (
    <div className="overlay">
      <div className="container">
        <TopBar
          address={address}
          balance={balance.isLoading ? "..." : balanceFmt}
          chainName="Sepolia"
          onDisconnect={() => disconnect()}
        />

        <div className="spacer" />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {matches.map((m, idx) => (
            <MatchCard
              key={m.matchId}
              match={m}
              marketId={idx + 1} // simple mapping: match index -> marketId
            />
          ))}
        </div>

        <div className="spacer" />
        <div className="card small">
          Note: marketId is currently mapped as (index + 1). If you later create markets on-chain, we’ll map matchId → marketId properly.
        </div>
      </div>
    </div>
  );
}
