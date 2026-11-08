import { useState } from 'react';
import { Building2, Expand, Gauge, Gem, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { LINE_MAP } from '../data/content.js';
import { ROOMS } from '../data/growth.js';
import { useGame } from '../context/GameContext.jsx';
import { PRESTIGE_EARNINGS, canPrestige, factoryValuation, prestigeGain, prestigeUpgradeCost, slotCost } from '../utils/growth.js';
import { formatMoney, formatNumber } from '../utils/formatter.js';
import { getLevelInfo } from '../utils/progression.js';
import UpgradeCard, { PanelHeader, SectionTitle, cashStatus } from './ui/UpgradeCard.jsx';

const PRESTIGE = [
  { key: 'speed', name: 'Seasoned presses', blurb: '+4% speed on every line per rank.', icon: Gauge },
  { key: 'yield', name: 'Better yield', blurb: '+5% price and larger raw drops per rank.', icon: Gem },
  { key: 'care', name: 'Careful hands', blurb: 'Machines wear 4% slower per rank.', icon: Wrench },
];

export default function ExpansionPanel() {
  const { state, buyRoom, buySlot, buyPrestigeUpgrade, prestige } = useGame();
  const level = getLevelInfo(state.totalXp).level;
  const owned = ROOMS.filter((room) => state.rooms[room.id]?.owned).length;
  const [confirm, setConfirm] = useState(false);
  const ready = canPrestige(state);

  return (
    <div className="stack">
      <PanelHeader
        icon={Building2}
        eyebrow="Factory expansion"
        title="Grow the works"
        text="Each room houses its own product lines. Extra machine bays run lines in parallel for a speed bonus."
        stats={[
          { label: 'Rooms', value: `${owned}/${ROOMS.length}` },
          { label: 'Factory value', value: formatMoney(factoryValuation(state)) },
        ]}
      />

      <section className="stack">
        <SectionTitle aside="Departments">Rooms and bays</SectionTitle>
        {ROOMS.map((room, index) => {
          const info = state.rooms[room.id] || { owned: false, slots: 0 };
          const slots = info.slots || 0;
          const lines = room.lines.map((id) => LINE_MAP[id]);
          if (info.owned) {
            const price = slotCost(room, slots);
            const full = slots >= 4;
            return (
              <UpgradeCard
                key={room.id}
                icon={Expand}
                eyebrow={`Dept 0${index + 1} · ${room.department}`}
                title={room.name}
                description={room.blurb}
                detail={`${1 + slots} of 5 machine bays · +${Math.round(slots * 18)}% parallel speed`}
                status={full ? 'maxed' : cashStatus(state.money, price)}
                statusText={full ? 'All bays' : undefined}
                progress={(1 + slots) / 5}
                actionLabel={full ? 'Bays full' : 'Add machine bay'}
                cost={full ? null : formatMoney(price)}
                onAction={() => buySlot(room.id)}
              >
                <RoomLines lines={lines} state={state} />
              </UpgradeCard>
            );
          }
          const levelOk = level >= room.level;
          return (
            <UpgradeCard
              key={room.id}
              icon={Building2}
              eyebrow={`Dept 0${index + 1} · ${room.department}`}
              title={room.name}
              description={room.blurb}
              status={!levelOk ? 'locked' : cashStatus(state.money, room.cost)}
              statusText={!levelOk ? `Level ${room.level}` : undefined}
              actionLabel={room.cost === 0 ? 'Open room' : 'Expand'}
              cost={room.cost ? formatMoney(room.cost) : null}
              onAction={() => buyRoom(room.id)}
            >
              <RoomLines lines={lines} state={state} />
            </UpgradeCard>
          );
        })}
      </section>

      <section className="stack">
        <SectionTitle aside={`${formatNumber(state.prestige.points)} points · ${state.prestige.runs} runs`}>Prestige</SectionTitle>
        <div className="card-grid">
          {PRESTIGE.map((item) => {
            const rank = state.prestige[item.key] || 0;
            const cost = prestigeUpgradeCost(rank);
            const maxed = rank >= 20;
            return (
              <UpgradeCard
                key={item.key}
                icon={item.icon}
                eyebrow={`Rank ${rank} / 20`}
                title={item.name}
                description={item.blurb}
                status={maxed ? 'maxed' : state.prestige.points >= cost ? 'available' : 'poor'}
                statusText={!maxed && state.prestige.points < cost ? 'Need prestige' : undefined}
                progress={rank / 20}
                actionLabel={maxed ? 'Maxed' : 'Invest'}
                cost={maxed ? null : `${cost} PP`}
                onAction={() => buyPrestigeUpgrade(item.key)}
              />
            );
          })}
        </div>
        <UpgradeCard
          icon={confirm ? RotateCcw : Sparkles}
          eyebrow="Optional"
          title={confirm ? 'Restart the works?' : 'Prestige the mill'}
          description="Restarts cash, rooms, lines, crew, and logistics. Keeps research, achievements, lifetime totals, and prestige bonuses."
          detail={ready ? `Next run grants ${prestigeGain(state)} prestige points.` : `Unlocks at level 10 or ${formatMoney(PRESTIGE_EARNINGS)} earned.`}
          status={ready ? (confirm ? 'ready' : 'available') : 'locked'}
          statusText={ready ? (confirm ? 'Confirm' : 'Ready') : 'Locked'}
          actionLabel={confirm ? 'Confirm prestige' : 'Prestige'}
          onAction={() => {
            if (confirm) {
              prestige();
              setConfirm(false);
            } else {
              setConfirm(true);
            }
          }}
        >
          {confirm ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Keep this run</button> : null}
        </UpgradeCard>
      </section>
    </div>
  );
}

function RoomLines({ lines, state }) {
  return (
    <div className="room-lines">
      {lines.map((def) => (
        <span key={def.id} className={state.lines[def.id]?.unlocked ? 'is-on' : ''} style={{ '--tone': def.palette.tag }}>
          <i />
          {def.short}
        </span>
      ))}
    </div>
  );
}
