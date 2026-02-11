export default function TopBar({ address, balance, chainName, onDisconnect }) {
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
          <button onClick={onDisconnect}>Disconnect</button>
        </div>
      </div>
    </div>
  );
}
