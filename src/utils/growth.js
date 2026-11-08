import { LINES } from '../data/content.js';
import { RESEARCH, RESEARCH_MAP, ROOMS } from '../data/growth.js';
import { getLevelInfo } from './progression.js';

export function roomForLine(lineId) {
  return ROOMS.find((room) => room.lines.includes(lineId)) || ROOMS[0];
}

export function hasTech(state, id) {
  return Boolean(state.research?.unlocked?.includes(id));
}

export function researchBonus(state, effect) {
  let total = 0;
  for (const id of state.research?.unlocked || []) {
    const tech = RESEARCH_MAP[id];
    if (tech?.effect === effect) total += tech.value;
  }
  return total;
}

export function parallelBonus(state, lineId) {
  const room = roomForLine(lineId);
  const extra = state.rooms?.[room.id]?.slots || 0;
  return 1 + extra * 0.18;
}

export function conditionEfficiency(line) {
  const condition = Math.max(0, Math.min(100, line?.condition ?? 100));
  return 0.62 + 0.38 * (condition / 100);
}

export function careFactor(state) {
  const crew = state.maintenanceCrew || 0;
  const prestige = state.prestige?.care || 0;
  return Math.min(0.75, crew * 0.08 + researchBonus(state, 'care') + prestige * 0.04);
}

export function wearPerItem(state) {
  return 0.22 * (1 - careFactor(state));
}

export function slotCost(room, slots) {
  return Math.ceil(room.slotCost * Math.pow(1.72, slots || 0));
}

export function materialCap(state) {
  const warehouse = state.upgrades?.warehouse || 0;
  const forks = state.logistics?.forklifts || 0;
  return 60 + warehouse * 25 + forks * 10 + Math.round(researchBonus(state, 'materials'));
}

export function truckInterval(state) {
  const trucks = state.logistics?.trucks || 0;
  const schedule = hasTech(state, 'dock-schedule') ? 2 : 0;
  return Math.max(6, 14 - trucks * 1.1 - schedule);
}

export function truckDrop(state) {
  const forks = state.logistics?.forklifts || 0;
  const rooms = ROOMS.filter((room) => state.rooms?.[room.id]?.owned).length;
  const prestige = state.prestige?.yield || 0;
  return 6 + forks * 4 + Math.max(0, rooms - 1) * 2 + prestige * 2 + Math.round(researchBonus(state, 'materials'));
}

export function repairCost(price, condition) {
  const missing = Math.max(0, 100 - (condition ?? 100));
  return Math.ceil(28 + missing * Math.max(0.4, price * 0.04));
}

export function forkliftCost(rank) {
  return Math.ceil(260 * Math.pow(1.62, rank || 0));
}

export function truckCost(rank) {
  return Math.ceil(420 * Math.pow(1.66, rank || 0));
}

export function crewCost(rank) {
  return Math.ceil(180 * Math.pow(1.65, rank || 0));
}

export function palletCost(state) {
  return Math.max(35, Math.round(20 + (state.materials || 0) * 0.4));
}

export function describeBottleneck(state, lineId, stalled) {
  const line = state.lines?.[lineId];
  if (!line) return 'Flowing';
  if (stalled) return 'Crate full';
  if ((line.condition ?? 100) < 40) return 'Needs service';
  if ((state.materials || 0) <= 0 && (line.raw || 0) <= 0) return 'Need raw';
  if ((line.raw || 0) <= 0 && (line.wip || 0) <= 0) return 'Intake slow';
  if ((line.wip || 0) <= 0) return 'Forming';
  return 'Flowing';
}

export function chainBuffer(line) {
  return 4 + Math.floor((line?.conveyor || 0) / 2);
}

export function canPrestige(state) {
  const level = getLevelInfo(state.totalXp || 0).level;
  return level >= 10 || (state.totalEarned || 0) >= 25000;
}

export function prestigeGain(state) {
  const level = getLevelInfo(state.totalXp || 0).level;
  const earned = Math.sqrt(Math.max(0, state.totalEarned || 0));
  return Math.max(1, Math.floor(level / 5) + Math.floor(earned / 90));
}

export function prestigeUpgradeCost(rank) {
  return 1 + (rank || 0);
}

export function employeeProductivity(state) {
  let score = 0;
  for (const employee of state.employees || []) {
    score += employee.level || 1;
  }
  return score;
}

export function averageCondition(state) {
  const open = LINES.filter((def) => state.lines?.[def.id]?.unlocked);
  if (!open.length) return 100;
  const sum = open.reduce((total, def) => total + (state.lines[def.id].condition ?? 100), 0);
  return sum / open.length;
}

export function itemsPerMinute(state, cycleFor) {
  let items = 0;
  for (const def of LINES) {
    const line = state.lines?.[def.id];
    if (!line?.unlocked) continue;
    const cycle = cycleFor(def.id);
    if (cycle > 0) items += 60 / cycle;
  }
  return items;
}

export function factoryValuation(state, stockValue) {
  const rooms = ROOMS.reduce((sum, room) => sum + (state.rooms?.[room.id]?.owned ? room.cost : 0), 0);
  const lines = LINES.reduce((sum, def) => sum + (state.lines?.[def.id]?.unlocked ? def.unlockCost : 0), 0);
  return Math.round((state.money || 0) + (stockValue || 0) + (state.materials || 0) * 2 + rooms + lines + (state.prestige?.points || 0) * 500);
}

export function buildMissions(state, now) {
  const level = Math.max(1, getLevelInfo(state.totalXp || 0).level);
  return [
    { id: `make-${dayKey(now)}`, kind: 'produce', goal: 8 + level * 2, progress: 0, claimed: false, label: `Finish ${8 + level * 2} pieces` },
    { id: `earn-${dayKey(now)}`, kind: 'earn', goal: 40 + level * 30, progress: 0, claimed: false, label: `Bank ${40 + level * 30} from sales` },
    { id: `orders-${dayKey(now)}`, kind: 'orders', goal: 1, progress: 0, claimed: false, label: 'Deliver 1 customer order' },
  ];
}

export function missionReward(state) {
  const level = Math.max(1, getLevelInfo(state.totalXp || 0).level);
  return { money: 25 + level * 15, xp: 10, points: 2 };
}

export function dayKey(now) {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function techReady(state, tech) {
  if (!tech) return false;
  if (state.research?.unlocked?.includes(tech.id)) return false;
  if (tech.requires && !state.research?.unlocked?.includes(tech.requires)) return false;
  return (state.research?.points || 0) >= tech.cost;
}

export { RESEARCH };
