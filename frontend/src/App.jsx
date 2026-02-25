import { useMemo, useState, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { formatUnits } from "viem";
import { sepolia } from "wagmi/chains";

import Landing from "./components/Landing";
import TopBar from "./components/TopBar";
import MatchCard from "./components/MatchCard";

import matchesJson from "./data/upcomingMatches.json";
import VPTokenAbi from "./abi/VPToken.json";
import { ADDRESSES, VPT_DECIMALS } from "./lib/addresses";

function makeMatchKey(m) {
  // stable unique key even when matchId is empty
  const home = m?.teams?.[0]?.clubName ?? "HOME";
  const away = m?.teams?.[1]?.clubName ?? "AWAY";
  const dt = m?.dateTime ?? `${m?.date ?? ""}T${m?.time ?? ""}`;
  return `${dt}__${home}__${away}`;
}

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

  // ✅ Put matches into state so MatchCard can update matchId after createMatchMarket()
  const [matches, setMatches] = useState(() => matchesJson.upcomingMatches ?? []);

  // ✅ Called by MatchCard after it decodes MatchMarketCreated.marketId
  const onMarketCreated = useCallback((match, newMarketId) => {
    const key = makeMatchKey(match);

    setMatches((prev) =>
      prev.map((m) => {
        if (makeMatchKey(m) !== key) return m;
        return { ...m, matchId: String(newMarketId) };
      })
    );

    // Optional: persist across refresh (localStorage)
    // localStorage.setItem(`marketId:${key}`, String(newMarketId));
  }, []);

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

        <div className="grid" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {matches.map((m) => (
            <MatchCard
              key={makeMatchKey(m)}
              match={m}
              marketId={m.matchId}
              onMarketCreated={onMarketCreated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}