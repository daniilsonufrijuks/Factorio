import { Bot, HardHat, Wrench } from 'lucide-react';
import { LINES, UPGRADE_KEYS } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { automationGateOpen, getLineStats, lineUpgradeCost, upgradeMax } from '../utils/economy.js';
import { averageCondition, careFactor, crewCost, repairCost } from '../utils/growth.js';
import { formatMoney, formatPercent } from '../utils/formatter.js';
import UpgradeCard, { PanelHeader, SectionTitle, cashStatus } from './ui/UpgradeCard.jsx';
import { compareText } from './UpgradePanel.jsx';

const AUTOMATION = UPGRADE_KEYS.find((upgrade) => upgrade.id === 'automation');

export default function RoboticsPanel() {
  const { state, buyLineUpgrade, setAutoSell, repairLine, buyCrew } = useGame();
  const open = LINES.filter((line) => state.lines[line.id].unlocked);
  const gate = automationGateOpen(state);
  const autoLines = open.filter((def) => getLineStats(state, def.id).autoSell).length;
  const crew = state.maintenanceCrew || 0;
  const crewPrice = crewCost(crew);

  return (
    <div className="stack">
      <PanelHeader
        icon={Bot}
        eyebrow="Robotics"
        title="Automate and maintain"
        text="Auto-sellers ship goods as they finish. Machines wear with use, and a worn press runs slower until it is serviced."
        stats={[
          { label: 'Auto lines', value: `${autoLines}/${open.length}` },
          { label: 'Avg condition', value: `${Math.round(averageCondition(state))}%`, tone: averageCondition(state) < 50 ? 'bad' : '' },
          { label: 'Wear cut', value: formatPercent(careFactor(state)) },
        ]}
      />

      <section className="stack">
        <SectionTitle aside={gate ? 'Per line' : 'Opens at level 2'}>Auto-sellers</SectionTitle>
        <div className="card-grid">
          {open.map((def) => {
            const line = state.lines[def.id];
            const rank = line.automation || 0;
            const max = upgradeMax('automation');
            const maxed = rank >= max;
            const lockedGate = rank === 0 && !gate;
            const cost = lineUpgradeCost(def, 'automation', rank);
            const stats = getLineStats(state, def.id);
            const next = getLineStats({ ...state, lines: { ...state.lines, [def.id]: { ...line, automation: rank + 1 } } }, def.id);
            let status = maxed ? 'maxed' : cashStatus(state.money, cost);
            if (lockedGate) status = 'locked';
            const on = line.autoSell && stats.autoReady;
            return (
              <UpgradeCard
                key={def.id}
                icon={Bot}
                tone={def.palette.tag}
                eyebrow={`${def.short} · rank ${rank} / ${max}`}
                title={rank === 0 ? 'Install auto-seller' : AUTOMATION.name}
                description={rank === 0 ? 'Ships each piece the moment it lands in storage.' : AUTOMATION.blurb}
                detail={lockedGate ? 'Reach level 2 to install.' : rank === 0 ? `Manual → auto at ${formatMoney(next.price)}` : compareText('automation', stats, next, maxed)}
                status={status}
                statusText={lockedGate ? 'Level 2' : undefined}
                progress={rank / max}
                actionLabel={maxed ? 'Maxed' : rank === 0 ? 'Install' : 'Upgrade'}
                cost={maxed || lockedGate ? null : formatMoney(cost)}
                onAction={() => buyLineUpgrade(def.id, 'automation')}
              >
                <button
                  type="button"
                  className={`switch sm ${on ? 'is-on' : ''}`}
                  disabled={!stats.autoReady}
                  onClick={() => setAutoSell(def.id, !on)}
                >
                  <i />
                  {stats.autoReady ? (on ? 'Selling automatically' : 'Paused') : 'Not installed'}
                </button>
              </UpgradeCard>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <SectionTitle aside="Repairs restore full speed">Machine condition</SectionTitle>
        <div className="card-grid">
          {open.map((def) => {
            const stats = getLineStats(state, def.id);
            const condition = Math.round(stats.condition);
            const price = repairCost(stats.price, stats.condition);
            const healthy = condition >= 99;
            let status = healthy ? 'owned' : cashStatus(state.money, price);
            let statusText = healthy ? 'Healthy' : condition < 40 ? 'Needs service' : 'Worn';
            if (!healthy && state.money < price) statusText = 'Need cash';
            return (
              <UpgradeCard
                key={def.id}
                icon={Wrench}
                tone={def.palette.tag}
                eyebrow={def.machine}
                title={def.product}
                detail={healthy ? 'Running at full efficiency.' : `${condition}% condition · slower cycles until serviced`}
                status={status}
                statusText={statusText}
                progress={condition / 100}
                progressLabel={`${condition}%`}
                actionLabel={healthy ? 'No service needed' : 'Repair'}
                cost={healthy ? null : formatMoney(price)}
                onAction={() => repairLine(def.id)}
              />
            );
          })}
        </div>
      </section>

      <section className="stack">
        <SectionTitle aside={`Rank ${crew} / 8`}>Maintenance crew</SectionTitle>
        <UpgradeCard
          icon={HardHat}
          eyebrow={`Wear reduced ${formatPercent(careFactor(state))}`}
          title={crew >= 8 ? 'Crew is full' : 'Hire a fitter'}
          description="A larger crew slows wear on every machine in the works."
          status={crew >= 8 ? 'maxed' : cashStatus(state.money, crewPrice)}
          progress={crew / 8}
          actionLabel={crew >= 8 ? 'Full crew' : 'Hire'}
          cost={crew >= 8 ? null : formatMoney(crewPrice)}
          onAction={buyCrew}
        />
      </section>
    </div>
  );
}
