import { X } from 'lucide-react';
import { LINES } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { getFactoryRates, getLineStats, getMaxOfflineSeconds } from '../utils/economy.js';
import { averageCondition, employeeProductivity, factoryValuation, itemsPerMinute } from '../utils/growth.js';
import { formatDuration, formatMoney, formatNumber } from '../utils/formatter.js';
import { getLevelInfo } from '../utils/progression.js';

export default function StatsModal() {
  const { state, modal, setModal } = useGame();
  if (modal !== 'stats') return null;
  const info = getLevelInfo(state.totalXp);
  const rates = getFactoryRates(state);
  const lines = LINES.filter((line) => state.lines[line.id].unlocked);
  let stockValue = 0;
  for (const def of lines) stockValue += state.lines[def.id].inventory * getLineStats(state, def.id).price;
  const perMinute = itemsPerMinute(state, (lineId) => getLineStats(state, lineId).cycle);

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="stats-title" onClick={() => setModal(null)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="split">
          <div>
            <p className="eyebrow">Statistics</p>
            <h2 id="stats-title">The books</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => setModal(null)} aria-label="Close statistics">
            <X size={18} />
          </button>
        </header>
        <dl className="stats-grid">
          <div><dt>Level</dt><dd>{info.level}</dd></div>
          <div><dt>Cash</dt><dd>{formatMoney(state.money)}</dd></div>
          <div><dt>Total revenue</dt><dd>{formatMoney(state.totalEarned)}</dd></div>
          <div><dt>Total profit</dt><dd>{formatMoney(state.totalEarned - (state.totalSpent || 0))}</dd></div>
          <div><dt>Products made</dt><dd>{formatNumber(state.totalProduced)}</dd></div>
          <div><dt>Orders completed</dt><dd>{formatNumber(state.ordersCompleted)}</dd></div>
          <div><dt>Machine efficiency</dt><dd>{Math.round(averageCondition(state))}%</dd></div>
          <div><dt>Crew productivity</dt><dd>{formatNumber(employeeProductivity(state))}</dd></div>
          <div><dt>Production / min</dt><dd>{formatNumber(perMinute)}</dd></div>
          <div><dt>Factory value</dt><dd>{formatMoney(factoryValuation(state, stockValue))}</dd></div>
          <div><dt>Auto income</dt><dd>{formatMoney(rates.auto)}/s</dd></div>
          <div><dt>Output</dt><dd>{formatMoney(rates.output)}/s</dd></div>
          <div><dt>Produced</dt><dd>{formatNumber(state.totalProduced)}</dd></div>
          <div><dt>Sold</dt><dd>{formatNumber(state.totalSold)}</dd></div>
          <div><dt>Orders delivered</dt><dd>{formatNumber(state.ordersCompleted)}</dd></div>
          <div><dt>Orders missed</dt><dd>{formatNumber(state.ordersExpired)}</dd></div>
          <div><dt>Upgrades bought</dt><dd>{formatNumber(state.upgradesBought)}</dd></div>
          <div><dt>Time on the floor</dt><dd>{formatDuration(state.playSeconds)}</dd></div>
          <div><dt>Night cap</dt><dd>{formatDuration(getMaxOfflineSeconds(state))}</dd></div>
        </dl>
        <h3 className="section-label">Lines</h3>
        <ul className="stats-lines">
          {lines.map((def) => {
            const line = state.lines[def.id];
            return (
              <li key={def.id}>
                <span className="swatch" style={{ background: def.palette.tag }} />
                <span>{def.product}</span>
                <span>{formatNumber(line.produced)} made</span>
                <span>{formatNumber(line.sold)} sold</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
