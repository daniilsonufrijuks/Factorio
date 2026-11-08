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
  let totalFree = 0;
  let totalHeld = 0;
  let totalValue = 0;
  for (const def of open) {
    const stats = getLineStats(state, def.id);
    totalUnits += state.lines[def.id].inventory;
    totalFree += stats.free;
    totalHeld += stats.held;
    totalValue += stats.free * stats.price;
  }

  return (
    <div className="stack">
      <PanelHeader
        icon={Warehouse}
        eyebrow="Warehouse"
        title={`${totalUnits} units on the racks`}
        text="Finished goods wait here until you sell them, deliver an order, or auto-sell ships them. Goods held for orders and trucks are never sold."
        stats={[
          { label: 'Free value', value: formatMoney(totalValue), tone: 'gold' },
          { label: 'Held', value: formatNumber(totalHeld) },
          { label: 'Raw yard', value: `${formatNumber(state.materials)}/${formatNumber(materialCap(state))}` },
        ]}
      />
      <div className="line-actions">
        <button type="button" className="btn btn-gold" disabled={totalFree <= 0} onClick={sellAll}>
          {totalFree > 0 || totalHeld <= 0 ? `Sell free stock · ${formatMoney(totalValue)}` : 'All stock is held'}
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
                  <p className="muted">
                    {stats.free} free · {stats.held} held
                    {stats.reserved > stats.held ? ` · ${stats.reserved - stats.held} still owed` : ''}
                  </p>
                </div>
              </div>
              <strong>{formatMoney(stats.free * stats.price)}</strong>
            </header>
            <div className="meter"><span style={{ width: `${fill}%`, background: def.palette.tag }} /></div>
            <div className="line-actions">
              <button type="button" className="btn btn-gold" disabled={stats.free <= 0} onClick={() => sellLine(def.id)}>
                {stats.free > 0 || stats.held <= 0 ? 'Sell free' : 'Held for orders'}
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
            {stats.stalled ? (
              <p className="warn">
                {stats.free <= 0 && stats.held > 0
                  ? 'The crate is full of goods held for orders. Deliver or add racks.'
                  : 'This line is stalled until you make room.'}
              </p>
            ) : stats.stocking ? (
              <p className="muted">Stocking an order: new pieces stay in the crate until it is covered.</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
