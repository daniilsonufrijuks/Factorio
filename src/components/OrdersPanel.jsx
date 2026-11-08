import { LINES } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { getLineStats } from '../utils/economy.js';
import { formatDuration, formatMoney } from '../utils/formatter.js';
import { ClipboardList } from 'lucide-react';
import { PanelHeader } from './ui/UpgradeCard.jsx';

const TYPE_LABEL = {
  standard: 'Standard',
  bulk: 'Bulk',
  premium: 'Premium',
  timed: 'Rush',
};

export default function OrdersPanel() {
  const { state, completeOrder, setAutoSell } = useGame();
  const now = Date.now();

  return (
    <div className="stack">
      <PanelHeader
        icon={ClipboardList}
        eyebrow="Orders"
        title="Customers pay above street price"
        text="Auto-sell lines hold goods for open tickets and street-sell the rest. Hold a line to keep everything in the crate."
        stats={[
          { label: 'Open', value: state.orders.length },
          { label: 'Ready', value: state.orders.filter((order) => (state.lines[order.lineId]?.inventory || 0) >= order.qty).length, tone: 'gold' },
          { label: 'Delivered', value: state.ordersCompleted || 0 },
        ]}
      />
      {state.orders.length === 0 ? <p className="empty">The order desk is quiet. A new ticket will land shortly.</p> : null}
      {state.orders.map((order) => {
        const def = LINES.find((line) => line.id === order.lineId);
        const have = state.lines[order.lineId]?.inventory || 0;
        const ready = have >= order.qty;
        const remaining = order.deadline ? Math.max(0, (order.deadline - now) / 1000) : null;
        const stats = state.lines[order.lineId]?.unlocked ? getLineStats(state, order.lineId) : null;
        const auto = Boolean(stats?.autoSell);
        return (
          <article key={order.id} className={`card order-card type-${order.type}`}>
            <header className="split">
              <div>
                <p className="eyebrow">{TYPE_LABEL[order.type] || 'Order'} · {order.difficulty}</p>
                <h3>{order.title}</h3>
                <p className="muted">{order.customer}</p>
              </div>
              {def ? <span className="swatch lg" style={{ background: def.palette.tag }} /> : null}
            </header>
            <p className="order-need">
              <strong>{order.qty} {def?.product || 'goods'}</strong>
              <span>{have} in the crate</span>
            </p>
            {auto ? (
              <p className="muted">
                {stats.held} held for orders · {stats.free} free to sell
                {stats.stocking ? ' · stocking now' : ''}
              </p>
            ) : null}
            <div className="meter">
              <span style={{ width: `${Math.min(100, (have / order.qty) * 100)}%`, background: def?.palette.tag || '#ffb020' }} />
            </div>
            <div className="stat-row">
              <span>Pays {formatMoney(order.reward)}</span>
              <span>{order.xp} XP</span>
              <span>{remaining == null ? 'No deadline' : formatDuration(remaining)}</span>
            </div>
            <div className="line-actions">
              <button type="button" className="btn btn-gold" disabled={!ready} onClick={() => completeOrder(order.id)}>
                {ready ? 'Deliver order' : `Short ${order.qty - have}`}
              </button>
              {auto ? (
                <button type="button" className="btn btn-ghost" onClick={() => setAutoSell(order.lineId, false)}>
                  Hold this line
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
