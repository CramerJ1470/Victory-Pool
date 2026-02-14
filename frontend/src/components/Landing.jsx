// src/pages/Landing.jsx
import frontpage from "../assets/frontpage.jpg";

export default function Landing({ onConnect, connecting, needsSepolia, onSwitch }) {
  return (
    <div className="overlay">
      <div className="container">
        {/* Top card (connect / switch) */}
        <div
          className="card"
          style={{
            width: "min(560px, 92vw)",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <img
            src={frontpage}
            alt="Victory Pool"
            style={{
              width: "100%",
              maxWidth: 560,
              borderRadius: 14,
              display: "block",
              margin: "0 auto",
            }}
          />

          <div className="spacer" />

          {needsSepolia ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Switch to Sepolia</div>
              <div className="spacer" />
              <button onClick={onSwitch} style={{ width: "100%" }}>
                Switch Network
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Connect your wallet</div>
              <div className="spacer" />
              <button
                onClick={onConnect}
                disabled={connecting}
                style={{ width: "100%" }}
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </>
          )}

          <div className="spacer" />
          <div className="small">Sepolia testnet • Stake/Bet with VPT</div>
        </div>

        {/* IMPORTANT: single-column layout container for match cards */}
        <div
          style={{
            marginTop: 18,
           gridTemplateColumns: "1fr auto 1fr",
            flexDirection: "column",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          {/* Render your MatchCard list OUTSIDE this component (likely in another page),
              OR if you render it here, ensure it's inside this container. */}
        </div>
      </div>
    </div>
  );
}
