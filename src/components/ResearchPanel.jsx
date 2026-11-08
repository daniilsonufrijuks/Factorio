import { Bot, Cog, FlaskConical, Truck, Zap } from 'lucide-react';
import { RESEARCH, RESEARCH_MAP } from '../data/growth.js';
import { useGame } from '../context/GameContext.jsx';
import { formatNumber } from '../utils/formatter.js';
import UpgradeCard, { PanelHeader, SectionTitle } from './ui/UpgradeCard.jsx';

const CATEGORY_ICONS = { Machines: Cog, Robotics: Bot, Logistics: Truck, Automation: Zap };

export default function ResearchPanel() {
  const { state, research } = useGame();
  const points = Math.floor(state.research?.points || 0);
  const done = state.research?.unlocked || [];
  const categories = [...new Set(RESEARCH.map((tech) => tech.category))];

  return (
    <div className="stack">
      <PanelHeader
        icon={FlaskConical}
        eyebrow="Research"
        title="The engineering lab"
        text="Every finished piece earns research points. Projects are permanent and survive a prestige."
        stats={[
          { label: 'Points', value: formatNumber(points), tone: 'gold' },
          { label: 'Projects', value: `${done.length}/${RESEARCH.length}` },
        ]}
      />
      {categories.map((category) => {
        const techs = RESEARCH.filter((tech) => tech.category === category);
        const finished = techs.filter((tech) => done.includes(tech.id)).length;
        return (
          <section key={category} className="stack">
            <SectionTitle aside={`${finished}/${techs.length}`}>{category}</SectionTitle>
            <div className="tech-chain">
              {techs.map((tech) => {
                const owned = done.includes(tech.id);
                const blocked = tech.requires && !done.includes(tech.requires);
                let status = 'available';
                let statusText;
                if (owned) {
                  status = 'owned';
                  statusText = 'Installed';
                } else if (blocked) {
                  status = 'needs';
                  statusText = RESEARCH_MAP[tech.requires]?.name || 'Previous project';
                } else if (points < tech.cost) {
                  status = 'poor';
                  statusText = 'Need points';
                }
                return (
                  <UpgradeCard
                    key={tech.id}
                    icon={CATEGORY_ICONS[category] || FlaskConical}
                    eyebrow={tech.requires ? `After ${RESEARCH_MAP[tech.requires]?.name}` : 'Root project'}
                    title={tech.name}
                    description={tech.blurb}
                    status={status}
                    statusText={statusText}
                    progress={owned ? 1 : Math.min(1, points / tech.cost)}
                    progressLabel={owned ? 'Complete' : `${Math.min(points, tech.cost)} / ${tech.cost} RP`}
                    actionLabel={owned ? 'Installed' : 'Research'}
                    cost={owned ? null : `${tech.cost} RP`}
                    onAction={() => research(tech.id)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
