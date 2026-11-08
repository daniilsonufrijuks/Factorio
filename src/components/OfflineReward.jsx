import { LINES } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { formatDuration, formatMoney, formatPercent } from '../utils/formatter.js';

export default function OfflineReward() {
  const { state, offlineOpen, collectOffline } = useGame();
  const pending = state.pendingOffline;
  if (!offlineOpen || !pending) return null;
  const stock = Object.entries(pending.stock || {}).filter(([, count]) => count > 0);

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="offline-title">
      <div className="modal offline-modal">
        <p className="eyebrow">While you were away</p>
        <h2 id="offline-title">The night shift kept the lights on</h2>
        <p className="offline-time">{formatDuration(pending.seconds)}</p>
        <p className="muted">
          Recovered {formatPercent(pending.efficiency)} of output
          {pending.hitCap ? ' · night cap reached' : ''}.
        </p>
        <div className="offline-money">{formatMoney(pending.money)}</div>
        {pending.capped ? <p className="warn">Some crates were already full, so overflow sold at half the night rate.</p> : null}
        {stock.length > 0 ? (
          <ul className="stock-list">
            {stock.map(([lineId, count]) => {
              const def = LINES.find((line) => line.id === lineId);
              return <li key={lineId}><span className="swatch" style={{ background: def?.palette.tag }} />{count} {def?.product}</li>;
            })}
          </ul>
        ) : null}
        {pending.xp > 0 ? <p className="muted">+{pending.xp} XP</p> : null}
        <button type="button" className="btn btn-gold btn-block" onClick={collectOffline}>Collect</button>
      </div>
    </div>
  );
}
