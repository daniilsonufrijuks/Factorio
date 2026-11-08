import { LINES, EMPLOYEES } from '../data/content.js';
import { useGame } from '../context/GameContext.jsx';
import { describeEmployee, employeeTrainCost, getSlots } from '../utils/economy.js';
import { formatMoney } from '../utils/formatter.js';
import { getLevelInfo } from '../utils/progression.js';
import { Users } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { PanelHeader, SectionTitle } from './ui/UpgradeCard.jsx';

export default function EmployeePanel() {
  const { state, hire, train, assign } = useGame();
  const level = getLevelInfo(state.totalXp).level;
  const slots = getSlots(state);
  const openLines = LINES.filter((line) => state.lines[line.id].unlocked);

  return (
    <div className="stack">
      <PanelHeader
        icon={Users}
        eyebrow="Workers"
        title="People who change the numbers"
        text="Line crew only pay off once you station them. Managers cover every open line."
        stats={[
          { label: 'Desks', value: `${state.employees.length}/${slots}` },
          { label: 'Stationed', value: state.employees.filter((employee) => employee.assignedLineId).length },
        ]}
      />
      {state.employees.length === 0 ? (
        <p className="empty">The floor is still a one-person shop. Milo will take the first desk.</p>
      ) : null}
      {state.employees.length > 0 ? <SectionTitle>On the floor</SectionTitle> : null}
      {state.employees.map((employee) => {
        const template = EMPLOYEES.find((entry) => entry.id === employee.templateId);
        if (!template) return null;
        const cost = employeeTrainCost(template, employee.level);
        return (
          <article key={employee.uid} className="card crew-card">
            <Avatar portrait={template.portrait} />
            <div className="crew-copy">
              <header className="split">
                <div>
                  <h3>{template.name}</h3>
                  <p className="role">{template.role} · level {employee.level}</p>
                </div>
                <button type="button" className="btn btn-gold" disabled={employee.level >= 20 || state.money < cost} onClick={() => train(template.id)}>
                  {employee.level >= 20 ? 'Maxed' : `Train ${formatMoney(cost)}`}
                </button>
              </header>
              <p>{template.blurb}</p>
              <p className="good">{describeEmployee(template, employee.level)}</p>
              {template.scope === 'line' ? (
                <div className="assign">
                  <button type="button" className={!employee.assignedLineId ? 'is-on' : ''} onClick={() => assign(template.id, null)}>Bench</button>
                  {openLines.map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      className={employee.assignedLineId === line.id ? 'is-on' : ''}
                      onClick={() => assign(template.id, line.id)}
                    >
                      {line.short}
                    </button>
                  ))}
                </div>
              ) : <p className="muted">Company-wide. No station needed.</p>}
            </div>
          </article>
        );
      })}

      <SectionTitle aside={`${state.employees.length}/${slots} desks`}>Hiring desk</SectionTitle>
      {EMPLOYEES.map((template) => {
        const hired = state.employees.some((employee) => employee.templateId === template.id);
        if (hired) return null;
        const locked = level < template.unlockLevel;
        const full = state.employees.length >= slots;
        return (
          <article key={template.id} className={`card crew-card ${locked ? 'is-locked' : ''}`}>
            <Avatar portrait={template.portrait} />
            <div className="crew-copy">
              <header className="split">
                <div>
                  <h3>{template.name}</h3>
                  <p className="role">{template.role}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={locked || full || state.money < template.hireCost}
                  onClick={() => hire(template.id)}
                >
                  {locked ? `Lv ${template.unlockLevel}` : formatMoney(template.hireCost)}
                </button>
              </header>
              <p>{template.blurb}</p>
              <p className="muted">{describeEmployee(template, 1)}</p>
              {full && !locked ? <p className="warn">Desks are full.</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
