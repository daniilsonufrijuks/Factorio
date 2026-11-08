import { GLOBAL_UPGRADES, LINE_MAP, LINES } from '../../data/content.js';
import {
  automationGateOpen,
  globalUpgradeCost,
  lineUpgradeCost,
  upgradeMax,
} from '../../utils/economy.js';
import { getLevelInfo, grantXp } from '../../utils/progression.js';
import { lineRoomOpen } from './GrowthSystem.js';
import { roomForLine } from '../../utils/growth.js';

function fail(reason) {
  return { ok: false, reason };
}

export function buyLineUpgrade(state, events, lineId, key) {
  const def = LINE_MAP[lineId];
  const line = state.lines[lineId];
  if (!def || !line?.unlocked) return fail('Open that line first.');
  if (!def.upgradeBase[key]) return fail('Unknown upgrade.');
  const level = line[key] || 0;
  if (level >= upgradeMax(key)) return fail('That upgrade is maxed.');
  if (key === 'automation' && level === 0 && !automationGateOpen(state)) {
    return fail('Reach level 2 to install auto-sell.');
  }
  const cost = lineUpgradeCost(def, key, level);
  if (state.money < cost) return fail('Not enough cash.');
  state.money -= cost;
  state.totalSpent = (state.totalSpent || 0) + cost;
  line[key] = level + 1;
  state.upgradesBought += 1;
  if (key === 'automation' && line.automation === 1) line.autoSell = true;
  if (state.tutorialStep < 3) state.tutorialStep = 3;
  grantXp(state, 6 + line[key], events);
  events.push({
    type: 'upgrade',
    lineId,
    key,
    message: `${def.short} ${labelFor(key)} is now rank ${line[key]}.`,
  });
  return { ok: true };
}

export function buyGlobalUpgrade(state, events, id) {
  const def = GLOBAL_UPGRADES.find((item) => item.id === id);
  if (!def) return fail('Unknown mill upgrade.');
  const level = state.upgrades[id] || 0;
  if (level >= def.max) return fail('That upgrade is maxed.');
  const cost = globalUpgradeCost(id, level);
  if (state.money < cost) return fail('Not enough cash.');
  state.money -= cost;
  state.totalSpent = (state.totalSpent || 0) + cost;
  state.upgrades[id] = level + 1;
  state.upgradesBought += 1;
  if (state.tutorialStep < 3) state.tutorialStep = 3;
  grantXp(state, 8 + level, events);
  events.push({ type: 'upgrade', message: `${def.name} is now rank ${state.upgrades[id]}.` });
  return { ok: true };
}

export function unlockLine(state, events, lineId) {
  const def = LINE_MAP[lineId];
  const line = state.lines[lineId];
  if (!def || !line) return fail('Unknown line.');
  if (line.unlocked) return fail('That line is already open.');
  const level = getLevelInfo(state.totalXp).level;
  if (level < def.unlockLevel) return fail(`Reach level ${def.unlockLevel} to open this line.`);
  const previous = previousLine(def);
  if (previous && !state.lines[previous.id].unlocked) {
    return fail(`Open ${previous.short} first.`);
  }
  if (!lineRoomOpen(state, lineId)) {
    return fail(`Expand into the ${roomForLine(lineId).name.toLowerCase()} first.`);
  }
  if (state.money < def.unlockCost) return fail('Not enough cash.');
  state.money -= def.unlockCost;
  state.totalSpent = (state.totalSpent || 0) + def.unlockCost;
  line.raw = Math.max(line.raw || 0, 2);
  line.wip = Math.max(line.wip || 0, 2);
  line.unlocked = true;
  state.upgradesBought += 1;
  grantXp(state, 40 * def.tier, events);
  events.push({ type: 'line-unlock', lineId, message: `${def.product} is on the floor.` });
  return { ok: true };
}

function previousLine(def) {
  const index = LINES.findIndex((line) => line.id === def.id);
  return index > 0 ? LINES[index - 1] : null;
}

function labelFor(key) {
  if (key === 'speed') return 'speed';
  if (key === 'conveyor') return 'belt';
  if (key === 'value') return 'finish';
  if (key === 'capacity') return 'storage';
  if (key === 'automation') return 'auto-seller';
  return 'upgrade';
}
