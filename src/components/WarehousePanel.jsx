import { LINES } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { getLineStats } from '../utils/economy.js';
import { materialCap, palletCost } from '../utils/growth.js';
import { formatMoney, formatNumber } from '../utils/formatter.js';
import { Warehouse } from 'lucide-react';
import { PanelHeader } from './ui/UpgradeCard.jsx';

export default function WarehousePanel() {
  const { state, sellLine, sellAll, setAutoSell, openUpgrades, buyPallet } = useGame();
  const open = LINES.filter((line) => state.lines[line.id].unlocked);
  let totalUnits = 0;
  let totalValue = 0;
  for (const def of open) {
    const stats = getLineStats(state, def.id);
    totalUnits += state.lines[def.id].inventory;
    totalValue += state.lines[def.id].inventory * stats.price;
  }

  return (
    <div className="stack">
      <PanelHeader
        icon={Warehouse}
        eyebrow="Warehouse"
        title={`${totalUnits} units on the racks`}
        text="Finished goods wait here until you sell them, deliver an order, or auto-sell ships them."
        stats={[
          { label: 'Value', value: formatMoney(totalValue), tone: 'gold' },
          { label: 'Raw yard', value: `${formatNumber(state.materials)}/${formatNumber(materialCap(state))}` },
        ]}
      />
      <div className="line-actions">
        <button type="button" className="btn btn-gold" disabled={totalUnits <= 0} onClick={sellAll}>
          Sell everything · {formatMoney(totalValue)}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openUpgrades(null)}>Add racks</button>
        <button type="button" className="btn" disabled={state.money < palletCost(state)} onClick={buyPallet}>Raw pallet · {formatMoney(palletCost(state))}</button>
      </div>
      {open.map((def) => {
        const line = state.lines[def.id];
        const stats = getLineStats(state, def.id);
        const fill = Math.min(100, (line.inventory / stats.capacity) * 100);
        return (
          <article key={def.id} className="card">
            <header className="split">
              <div className="title-with-swatch">
                <span className="swatch" style={{ background: def.palette.tag }} />
                <div>
                  <h3>{def.product}</h3>
                  <p className="muted">{line.inventory} / {stats.capacity} · {formatMoney(stats.price)} each</p>
                </div>
              </div>
              <strong>{formatMoney(line.inventory * stats.price)}</strong>
            </header>
            <div className="meter"><span style={{ width: `${fill}%`, background: def.palette.tag }} /></div>
            <div className="line-actions">
              <button type="button" className="btn btn-gold" disabled={line.inventory <= 0} onClick={() => sellLine(def.id)}>
                Sell line
              </button>
              <button
                type="button"
                className={`switch ${line.autoSell && stats.autoReady ? 'is-on' : ''}`}
                disabled={!stats.autoReady}
                onClick={() => setAutoSell(def.id, !(line.autoSell && stats.autoReady))}
              >
                <i />
                {stats.autoReady ? 'Auto-sell' : 'Needs automation'}
              </button>
            </div>
            {stats.stalled ? <p className="warn">This line is stalled until you make room.</p> : null}
          </article>
        );
      })}
    </div>
  );
}
