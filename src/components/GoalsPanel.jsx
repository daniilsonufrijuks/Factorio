import { CalendarCheck, Target, Trophy } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/growth.js';
import { useGame } from '../context/GameContext.jsx';
import { missionReward } from '../utils/growth.js';
import { formatMoney } from '../utils/formatter.js';
import UpgradeCard, { PanelHeader, SectionTitle } from './ui/UpgradeCard.jsx';

export default function GoalsPanel() {
  const { state, claimMission } = useGame();
  const reward = missionReward(state);
  const missions = state.daily?.missions || [];
  const unlocked = ACHIEVEMENTS.filter((item) => state.achievements[item.id]).length;

  return (
    <div className="stack">
      <PanelHeader
        icon={Target}
        eyebrow="Goals"
        title="Missions and milestones"
        text="Three jobs refresh every day. Achievements pay once, the first time you reach them."
        stats={[
          { label: 'Today', value: `${missions.filter((mission) => mission.claimed).length}/${missions.length}` },
          { label: 'Achievements', value: `${unlocked}/${ACHIEVEMENTS.length}` },
        ]}
      />

      <section className="stack">
        <SectionTitle aside={`${formatMoney(reward.money)} · ${reward.points} RP each`}>Daily missions</SectionTitle>
        {missions.map((mission) => {
          const done = mission.progress >= mission.goal;
          const progress = Math.min(mission.goal, Math.floor(mission.progress));
          return (
            <UpgradeCard
              key={mission.id}
              icon={CalendarCheck}
              eyebrow="Today"
              title={mission.label}
              status={mission.claimed ? 'owned' : done ? 'ready' : 'idle'}
              statusText={mission.claimed ? 'Claimed' : done ? 'Ready' : 'In progress'}
              progress={progress / mission.goal}
              progressLabel={`${progress} / ${mission.goal}`}
              actionLabel={mission.claimed ? 'Claimed' : 'Claim reward'}
              cost={mission.claimed ? null : formatMoney(reward.money)}
              onAction={() => claimMission(mission.id)}
            />
          );
        })}
      </section>

      <section className="stack">
        <SectionTitle aside={`${unlocked} earned`}>Achievements</SectionTitle>
        <div className="badge-grid">
          {ACHIEVEMENTS.map((item) => {
            const earned = Boolean(state.achievements[item.id]);
            return (
              <article key={item.id} className={`badge-card ${earned ? 'is-earned' : ''}`}>
                <span className="badge-icon"><Trophy size={18} /></span>
                <div>
                  <h4>{item.name}</h4>
                  <p>{item.blurb}</p>
                  <small>{earned ? 'Earned' : `+${formatMoney(item.money)} · ${item.xp} XP`}</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
