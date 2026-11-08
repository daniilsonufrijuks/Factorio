import { EMPLOYEE_MAP, LINE_MAP } from '../../data/content.js';
import { employeeTrainCost, getSlots } from '../../utils/economy.js';
import { getLevelInfo, grantXp } from '../../utils/progression.js';

const MAX_PER_LINE = 3;
const MAX_LEVEL = 20;

function fail(reason) {
  return { ok: false, reason };
}

export function hireEmployee(state, events, templateId) {
  const template = EMPLOYEE_MAP[templateId];
  if (!template) return fail('Unknown hire.');
  if (state.employees.some((employee) => employee.templateId === templateId)) {
    return fail('Already on the crew.');
  }
  const level = getLevelInfo(state.totalXp).level;
  if (level < template.unlockLevel) return fail(`Reach level ${template.unlockLevel} to hire ${template.name}.`);
  if (state.employees.length >= getSlots(state)) return fail('No open desks. Buy a hiring license or level up.');
  if (state.money < template.hireCost) return fail('Not enough cash.');
  state.money -= template.hireCost;
  state.totalSpent = (state.totalSpent || 0) + template.hireCost;
  const employee = {
    uid: `e-${template.id}`,
    templateId: template.id,
    level: 1,
    assignedLineId: null,
  };
  if (template.scope === 'line') {
    const lineId = firstOpenLine(state);
    if (lineId) employee.assignedLineId = lineId;
  }
  state.employees.push(employee);
  if (template.grantsAuto) {
    const targets = template.scope === 'global'
      ? Object.values(state.lines).filter((line) => line.unlocked)
      : [state.lines[employee.assignedLineId]].filter(Boolean);
    for (const line of targets) line.autoSell = true;
  }
  grantXp(state, 16, events);
  events.push({ type: 'hire', templateId, message: `${template.name} joined the floor.` });
  return { ok: true };
}

export function trainEmployee(state, events, templateId) {
  const template = EMPLOYEE_MAP[templateId];
  const employee = state.employees.find((entry) => entry.templateId === templateId);
  if (!template || !employee) return fail('Hire them first.');
  if (employee.level >= MAX_LEVEL) return fail('Fully trained.');
  const cost = employeeTrainCost(template, employee.level);
  if (state.money < cost) return fail('Not enough cash.');
  state.money -= cost;
  state.totalSpent = (state.totalSpent || 0) + cost;
  employee.level += 1;
  state.upgradesBought += 1;
  grantXp(state, 5 + employee.level, events);
  events.push({ type: 'upgrade', message: `${template.name} is now level ${employee.level}.` });
  return { ok: true };
}

export function assignEmployee(state, events, templateId, lineId) {
  const template = EMPLOYEE_MAP[templateId];
  const employee = state.employees.find((entry) => entry.templateId === templateId);
  if (!template || !employee) return fail('Hire them first.');
  if (template.scope === 'global') return fail(`${template.name} already covers the whole mill.`);
  if (lineId == null) {
    employee.assignedLineId = null;
    events.push({ type: 'mode', message: `${template.name} is between stations.` });
    return { ok: true };
  }
  if (!LINE_MAP[lineId] || !state.lines[lineId]?.unlocked) return fail('That line is not open.');
  const count = state.employees.filter((entry) => entry.assignedLineId === lineId && entry.uid !== employee.uid).length;
  if (count >= MAX_PER_LINE) return fail('That line already has three people on it.');
  employee.assignedLineId = lineId;
  events.push({ type: 'mode', message: `${template.name} moved to ${LINE_MAP[lineId].short}.` });
  return { ok: true };
}

function firstOpenLine(state) {
  for (const [lineId, line] of Object.entries(state.lines)) {
    if (!line.unlocked) continue;
    const count = state.employees.filter((employee) => employee.assignedLineId === lineId).length;
    if (count < MAX_PER_LINE) return lineId;
  }
  return null;
}
