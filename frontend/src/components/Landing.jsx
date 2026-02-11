import frontpage from "../assets/frontpage.jpg";

export default function Landing({ onConnect, connecting, needsSepolia, onSwitch }) {
  return (
    <div className="overlay">
      <div className="container">
        <div className="card" style={{ textAlign: "center" }}>
          <img src={frontpage} alt="Victory Pool" style={{ width: "100%", maxWidth: 520, borderRadius: 14 }} />
          <div className="spacer" />
          {needsSepolia ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Switch to Sepolia</div>
              <div className="spacer" />
              <button onClick={onSwitch}>Switch Network</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Connect your wallet</div>
              <div className="spacer" />
              <button onClick={onConnect} disabled={connecting}>
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </>
          )}
          <div className="spacer" />
          <div className="small">Sepolia testnet • Stake/Bet with VPT</div>
        </div>
      </div>
    </div>
  );
}
