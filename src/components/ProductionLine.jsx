import { LINES } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { Factory } from 'lucide-react';
import { getFactoryRates, getLineStats } from '../utils/economy.js';
import { PanelHeader } from './ui/UpgradeCard.jsx';
import { repairCost } from '../utils/growth.js';
import { formatMoney, formatRate } from '../utils/formatter.js';

export default function ProductionLine({ lineId, compact = false }) {
  const { state, sellLine, setAutoSell, openUpgrades, repairLine } = useGame();
  const def = LINES.find((line) => line.id === lineId);
  const line = state.lines[lineId];
  if (!def || !line?.unlocked) return null;
  const stats = getLineStats(state, lineId);
  const fill = Math.min(100, (line.inventory / stats.capacity) * 100);

  return (
    <article className={`line-card ${stats.stalled ? 'is-stalled' : ''}`}>
      <header className="line-card-head">
        <span className="swatch" style={{ background: def.palette.tag }} />
        <div>
          <h3>{def.short}</h3>
          <p>{def.product}</p>
        </div>
        <strong className="line-rate">{formatRate(stats.perSec)}/s</strong>
      </header>
      {compact ? null : <p className="muted">{def.blurb}</p>}
      <div className="stat-row">
        <span>Every {stats.cycle < 10 ? stats.cycle.toFixed(1) : Math.round(stats.cycle)}s</span>
        <span>{formatMoney(stats.price)} each</span>
        <span className={stats.autoSell ? 'good' : ''}>{stats.autoSell ? 'Auto' : 'Manual'}</span>
      </div>
      <div className="stat-row">
        <span>Raw {stats.raw}</span>
        <span>Formed {stats.wip}</span>
        <span>Condition {Math.round(stats.condition)}%</span>
      </div>
      <p className={stats.bottleneck === 'Flowing' ? 'muted' : 'warn'}>{stats.bottleneck}</p>
      <div className="meter" aria-label={`${line.inventory} of ${stats.capacity} in storage`}>
        <span style={{ width: `${fill}%`, background: def.palette.tag }} />
      </div>
      <div className="line-actions">
        <button type="button" className="btn btn-gold" disabled={line.inventory <= 0} onClick={() => sellLine(lineId)}>
          Sell {line.inventory > 0 ? formatMoney(line.inventory * stats.price) : 'empty'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openUpgrades(lineId)}>Upgrade</button>
      </div>
      <button
        type="button"
        className={`switch ${line.autoSell && stats.autoReady ? 'is-on' : ''}`}
        disabled={!stats.autoReady}
        onClick={() => setAutoSell(lineId, !(line.autoSell && stats.autoReady))}
      >
        <i />
        {stats.autoReady ? 'Auto-sell' : 'Auto-sell locked'}
      </button>
      {stats.stalled ? <p className="warn">Crate is full. Sell or add storage, or the belt stops.</p> : null}
      {stats.condition < 99 ? (
        <button type="button" className="btn" onClick={() => repairLine(lineId)}>
          Repair · {formatMoney(repairCost(stats.price, stats.condition))}
        </button>
      ) : null}
    </article>
  );
}

export function FactorySummary() {
  const { state } = useGame();
  const open = LINES.filter((line) => state.lines[line.id].unlocked);
  const rates = getFactoryRates(state);
  return (
    <div className="stack">
      <PanelHeader
        icon={Factory}
        eyebrow="Factory floor"
        title="Lines in motion"
        text="Tap a press on the floor to hurry a cycle. Sell storage here, or let auto-sell clear it."
        stats={[
          { label: 'Lines', value: `${open.length}/${LINES.length}` },
          { label: 'Output', value: `${formatRate(rates.output)}/s` },
          { label: 'Auto', value: `${formatRate(rates.auto)}/s`, tone: 'gold' },
        ]}
      />
      {open.map((line) => <ProductionLine key={line.id} lineId={line.id} />)}
    </div>
  );
}
