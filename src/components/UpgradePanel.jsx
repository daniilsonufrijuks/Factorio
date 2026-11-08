import { useEffect, useState } from 'react';
import { Boxes, ChevronsRight, Factory, Gauge, Gem, GraduationCap, Star, Warehouse } from 'lucide-react';
import { GLOBAL_UPGRADES, LINES, UPGRADE_KEYS } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import {
  describeGlobal,
  getFactoryRates,
  getLineStats,
  globalUpgradeCost,
  lineUpgradeCost,
  upgradeMax,
} from '../utils/economy.js';
import { formatMoney, formatRate } from '../utils/formatter.js';
import { getLevelInfo } from '../utils/progression.js';
import { roomForLine } from '../utils/growth.js';
import UpgradeCard, { PanelHeader, SectionTitle, cashStatus } from './ui/UpgradeCard.jsx';

const UPGRADE_ICONS = { speed: Gauge, conveyor: ChevronsRight, value: Gem, capacity: Boxes };
const GLOBAL_ICONS = { warehouse: Warehouse, training: GraduationCap, reputation: Star };
const PRODUCTION_KEYS = UPGRADE_KEYS.filter((upgrade) => upgrade.id !== 'automation');

export default function UpgradePanel() {
  const { state, focusLine, tab, buyLineUpgrade, buyGlobalUpgrade, unlockLine } = useGame();
  const level = getLevelInfo(state.totalXp).level;
  const unlocked = LINES.filter((line) => state.lines[line.id].unlocked);
  const locked = LINES.filter((line) => !state.lines[line.id].unlocked);
  const [selected, setSelected] = useState(focusLine || unlocked[0]?.id);
  const rates = getFactoryRates(state);

  useEffect(() => {
    if (tab === 'upgrades' && focusLine) setSelected(focusLine);
  }, [tab, focusLine]);

  const active = unlocked.find((line) => line.id === selected) || unlocked[0];
  const nextLine = locked[0];

  return (
    <div className="stack">
      <PanelHeader
        icon={Gauge}
        eyebrow="Production upgrades"
        title="Tune every line"
        text="Each rank costs more and pays back more. Pick a line to tune its press, belt, finish, and storage."
        stats={[
          { label: 'Lines open', value: `${unlocked.length}/${LINES.length}` },
          { label: 'Output', value: `${formatRate(rates.output)}/s` },
          { label: 'Level', value: level },
        ]}
      />

      {active ? (
        <section className="stack" id={`upgrade-${active.id}`}>
          <SectionTitle aside={active.machine}>Line upgrades</SectionTitle>
          <div className="line-pills" role="tablist" aria-label="Production line">
            {unlocked.map((def) => (
              <button
                key={def.id}
                type="button"
                role="tab"
                aria-selected={def.id === active.id}
                className={`line-pill ${def.id === active.id ? 'is-on' : ''}`}
                style={{ '--tone': def.palette.tag }}
                onClick={() => setSelected(def.id)}
              >
                <i />
                {def.short}
              </button>
            ))}
          </div>
          <div className="card-grid">
            {PRODUCTION_KEYS.map((upgrade) => (
              <LineUpgradeCard
                key={upgrade.id}
                state={state}
                def={active}
                upgrade={upgrade}
                onBuy={() => buyLineUpgrade(active.id, upgrade.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="stack">
        <SectionTitle aside="Every line">Factory-wide</SectionTitle>
        <div className="card-grid">
          {GLOBAL_UPGRADES.map((upgrade) => {
            const rank = state.upgrades[upgrade.id] || 0;
            const maxed = rank >= upgrade.max;
            const cost = globalUpgradeCost(upgrade.id, rank);
            return (
              <UpgradeCard
                key={upgrade.id}
                icon={GLOBAL_ICONS[upgrade.id] || Factory}
                eyebrow={`Rank ${rank} / ${upgrade.max}`}
                title={upgrade.name}
                description={upgrade.blurb}
                detail={maxed ? describeGlobal(upgrade.id, rank) : `${describeGlobal(upgrade.id, rank)} → ${describeGlobal(upgrade.id, rank + 1)}`}
                status={maxed ? 'maxed' : cashStatus(state.money, cost)}
                progress={rank / upgrade.max}
                actionLabel={maxed ? 'Maxed' : 'Upgrade'}
                cost={maxed ? null : formatMoney(cost)}
                onAction={() => buyGlobalUpgrade(upgrade.id)}
              />
            );
          })}
        </div>
      </section>

      {locked.length > 0 ? (
        <section className="stack">
          <SectionTitle aside={`${locked.length} to go`}>New lines</SectionTitle>
          {locked.map((def) => {
            const index = LINES.findIndex((line) => line.id === def.id);
            const previous = index > 0 ? LINES[index - 1] : null;
            const previousOpen = !previous || state.lines[previous.id].unlocked;
            const room = roomForLine(def.id);
            const roomOk = Boolean(state.rooms?.[room.id]?.owned);
            const levelOk = level >= def.unlockLevel;
            const affordable = state.money >= def.unlockCost;
            let status = 'available';
            let statusText = 'Ready';
            let note = `${formatMoney(def.basePrice)} base · ${def.baseCycle}s cycle`;
            if (!previousOpen) {
              status = 'needs';
              statusText = `After ${previous.short}`;
            } else if (!roomOk) {
              status = 'needs';
              statusText = room.name;
              note = `Expand into the ${room.name} first.`;
            } else if (!levelOk) {
              status = 'locked';
              statusText = `Level ${def.unlockLevel}`;
            } else if (!affordable) {
              status = 'poor';
            }
            const isNext = def.id === nextLine?.id;
            if (!isNext && status !== 'available') {
              return (
                <div key={def.id} className="locked-strip" style={{ '--tone': def.palette.tag }}>
                  <i />
                  <span>{def.product}</span>
                  <small>{status === 'needs' ? statusText : `Level ${def.unlockLevel}`}</small>
                </div>
              );
            }
            return (
              <UpgradeCard
                key={def.id}
                icon={Factory}
                tone={def.palette.tag}
                eyebrow={`${room.department} · line ${index + 1}`}
                title={def.product}
                description={def.blurb}
                detail={note}
                status={status}
                statusText={statusText}
                actionLabel={def.unlockCost === 0 ? 'Open line' : 'Build line'}
                cost={def.unlockCost ? formatMoney(def.unlockCost) : null}
                onAction={() => unlockLine(def.id)}
              />
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

function LineUpgradeCard({ state, def, upgrade, onBuy }) {
  const line = state.lines[def.id];
  const rank = line[upgrade.id] || 0;
  const max = upgradeMax(upgrade.id);
  const maxed = rank >= max;
  const cost = lineUpgradeCost(def, upgrade.id, rank);
  const current = getLineStats(state, def.id);
  const next = getLineStats({
    ...state,
    lines: {
      ...state.lines,
      [def.id]: { ...line, [upgrade.id]: rank + 1 },
    },
  }, def.id);

  return (
    <UpgradeCard
      icon={UPGRADE_ICONS[upgrade.id]}
      tone={def.palette.tag}
      eyebrow={`Rank ${rank} / ${max}`}
      title={upgrade.name}
      description={upgrade.blurb}
      detail={compareText(upgrade.id, current, next, maxed)}
      status={maxed ? 'maxed' : cashStatus(state.money, cost)}
      progress={rank / max}
      actionLabel={maxed ? 'Maxed' : 'Upgrade'}
      cost={maxed ? null : formatMoney(cost)}
      onAction={onBuy}
    />
  );
}

export function compareText(key, current, next, maxed) {
  if (maxed) return 'This rank is as high as it goes.';
  if (key === 'capacity') return `${current.capacity} → ${next.capacity} storage`;
  if (key === 'value' || key === 'automation') return `${formatMoney(current.price)} → ${formatMoney(next.price)} each`;
  const left = `${current.cycle.toFixed(1)}s · ${formatRate(current.perSec)}/s`;
  const right = `${next.cycle.toFixed(1)}s · ${formatRate(next.perSec)}/s`;
  return `${left} → ${right}`;
}
