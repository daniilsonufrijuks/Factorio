import {
  EMPLOYEE_MAP,
  GLOBAL_UPGRADES,
  LINES,
  SHOP_STACKS,
  UPGRADE_KEYS,
} from '../data/content.js';
import { getLevelInfo } from './progression.js';
import {
  conditionEfficiency,
  describeBottleneck,
  parallelBonus,
  researchBonus,
  reservedFor,
  truckDrop,
  truckInterval,
} from './growth.js';

const UPGRADE_GROWTH = Object.fromEntries(UPGRADE_KEYS.map((item) => [item.id, item.growth]));
const UPGRADE_MAX = Object.fromEntries(UPGRADE_KEYS.map((item) => [item.id, item.max]));

export function upgradeMax(key) {
  return UPGRADE_MAX[key] || 80;
}

export function getSlots(state) {
  const { level } = getLevelInfo(state.totalXp);
  return 2 + Math.floor((level - 1) / 4) + (state.shop?.slots || 0);
}

export function automationGateOpen(state) {
  return getLevelInfo(state.totalXp).level >= 2;
}

export function getBonuses(state, lineId) {
  const bonuses = { speed: 0, value: 0, capacity: 0, automation: 0, grantsAuto: false };
  bonuses.speed += (state.upgrades?.training || 0) * 0.03;
  bonuses.speed += (state.shop?.overclock || 0) * 0.05;
  bonuses.speed += (state.prestige?.speed || 0) * 0.04;
  bonuses.speed += researchBonus(state, 'speed');
  bonuses.value += (state.upgrades?.reputation || 0) * 0.06;
  bonuses.value += (state.shop?.brand || 0) * 0.08;
  bonuses.value += (state.prestige?.yield || 0) * 0.05;
  bonuses.value += researchBonus(state, 'value');
  bonuses.capacity += researchBonus(state, 'capacity');

  for (const employee of state.employees || []) {
    const template = EMPLOYEE_MAP[employee.templateId];
    if (!template) continue;
    const applies = template.scope === 'global' || employee.assignedLineId === lineId;
    if (!applies) continue;
    const level = employee.level || 1;
    bonuses.speed += (template.perLevel.speed || 0) * level;
    bonuses.value += (template.perLevel.value || 0) * level;
    bonuses.capacity += (template.perLevel.capacity || 0) * level;
    bonuses.automation += (template.perLevel.automation || 0) * level;
    if (template.grantsAuto) bonuses.grantsAuto = true;
  }
  return bonuses;
}

export function canAutomate(state, lineId) {
  const line = state.lines?.[lineId];
  if (!line) return false;
  const bonuses = getBonuses(state, lineId);
  return line.automation >= 1 || bonuses.grantsAuto;
}

export function getCycleTime(state, lineId, options = {}) {
  const def = LINES.find((line) => line.id === lineId);
  const line = state.lines?.[lineId];
  if (!def || !line) return 3;
  const speedLevel = options.speed ?? line.speed;
  const conveyorLevel = options.conveyor ?? line.conveyor;
  const bonuses = options.bonuses || getBonuses(state, lineId);
  const speedMult = (1 + speedLevel * 0.12) * (1 + conveyorLevel * 0.05) * (1 + bonuses.speed);
  let cycle = def.baseCycle / Math.max(0.2, speedMult);
  const boostOn = options.boost !== false && (state.shop?.boostUntil || 0) > Date.now();
  if (boostOn) cycle /= 2;
  cycle = cycle / conditionEfficiency(line) / parallelBonus(state, lineId);
  return Math.max(0.18, cycle);
}

export function getSellPrice(state, lineId, options = {}) {
  const def = LINES.find((line) => line.id === lineId);
  const line = state.lines?.[lineId];
  if (!def || !line) return 0;
  const valueLevel = options.value ?? line.value;
  const automation = options.automation ?? line.automation;
  const bonuses = options.bonuses || getBonuses(state, lineId);
  const quality = 1 + valueLevel * 0.14;
  const crew = 1 + bonuses.value;
  const auto = 1 + automation * 0.05 + bonuses.automation * 0.35;
  return def.basePrice * quality * crew * auto;
}

export function getCapacity(state, lineId, options = {}) {
  const def = LINES.find((line) => line.id === lineId);
  const line = state.lines?.[lineId];
  if (!def || !line) return 0;
  const capacityLevel = options.capacity ?? line.capacity;
  const bonuses = options.bonuses || getBonuses(state, lineId);
  const warehouse = state.upgrades?.warehouse || 0;
  const base = def.baseCapacity + capacityLevel * def.capacityStep;
  const mult = 1 + warehouse * 0.3 + bonuses.capacity;
  return Math.max(1, Math.floor(base * mult));
}

export function lineUpgradeCost(def, key, level) {
  const growth = UPGRADE_GROWTH[key] || 1.55;
  const base = def.upgradeBase[key];
  return Math.ceil(base * Math.pow(growth, level));
}

export function globalUpgradeCost(id, level) {
  const def = GLOBAL_UPGRADES.find((item) => item.id === id);
  if (!def) return Infinity;
  return Math.ceil(def.base * Math.pow(def.growth, level));
}

export function employeeTrainCost(template, level) {
  return Math.ceil(template.hireCost * 0.7 * Math.pow(1.58, Math.max(0, level - 1)));
}

export function stackCost(item, owned) {
  return Math.ceil(item.base * Math.pow(item.growth, owned));
}

export function getBeltPixels(conveyorLevel) {
  return 78 + conveyorLevel * 16;
}

export function getMaxOfflineSeconds(state) {
  const hours = Math.min(12, 2 + (state.shop?.night || 0));
  return hours * 3600;
}

export function getOfflineEfficiency(state) {
  const night = state.shop?.night || 0;
  let automation = 0;
  let counted = 0;
  for (const def of LINES) {
    const line = state.lines?.[def.id];
    if (!line?.unlocked) continue;
    automation += line.automation || 0;
    counted += 1;
  }
  const average = counted ? automation / counted : 0;
  return Math.min(0.95, 0.22 + night * 0.045 + average * 0.03 + researchBonus(state, 'offline'));
}

export function isCrateBlocked(inventory, capacity, auto, reserved) {
  return inventory >= capacity && (!auto || inventory < reserved);
}

export function getLineStats(state, lineId, overrides = {}) {
  const line = state.lines[lineId];
  const bonuses = getBonuses(state, lineId);
  const cycle = getCycleTime(state, lineId, { ...overrides, bonuses });
  const price = getSellPrice(state, lineId, { ...overrides, bonuses });
  const capacity = getCapacity(state, lineId, { ...overrides, bonuses });
  const autoReady = (overrides.automation ?? line.automation) >= 1 || bonuses.grantsAuto;
  const autoSell = Boolean(line.autoSell) && autoReady;
  const reserved = reservedFor(state, lineId);
  const stalled = isCrateBlocked(line.inventory, capacity, autoSell, reserved);
  return {
    cycle,
    price,
    perSec: price / cycle,
    capacity,
    inventory: line.inventory,
    reserved,
    held: Math.min(line.inventory, reserved),
    free: Math.max(0, line.inventory - reserved),
    stocking: autoSell && line.inventory < reserved,
    autoReady,
    autoSell,
    stalled,
    progress: Math.max(0, Math.min(1, line.progress / cycle)),
    bonuses,
    raw: line.raw || 0,
    wip: line.wip || 0,
    condition: line.condition ?? 100,
    bottleneck: describeBottleneck(state, lineId, stalled, autoSell),
  };
}

export function getFactoryRates(state) {
  const lines = {};
  let auto = 0;
  let output = 0;
  for (const def of LINES) {
    const line = state.lines[def.id];
    if (!line?.unlocked) continue;
    const stats = getLineStats(state, def.id);
    lines[def.id] = stats;
    output += stats.perSec;
    if (stats.autoSell) auto += stats.perSec;
  }
  return { auto, output, lines };
}

export function whistleCost(state) {
  const { output } = getFactoryRates(state);
  return Math.max(50, output * 90);
}

export function surgeReward(state) {
  const { output } = getFactoryRates(state);
  return Math.max(25, output * 60);
}

export function describeEmployee(template, level) {
  const parts = [];
  if (template.perLevel.speed) parts.push(`+${Math.round(template.perLevel.speed * level * 100)}% speed`);
  if (template.perLevel.value) parts.push(`+${Math.round(template.perLevel.value * level * 100)}% price`);
  if (template.perLevel.capacity) parts.push(`+${Math.round(template.perLevel.capacity * level * 100)}% storage`);
  if (template.perLevel.automation) parts.push(`+${Math.round(template.perLevel.automation * level * 100)}% automation`);
  if (template.grantsAuto) parts.push(template.scope === 'global' ? 'auto-sell on every line' : 'auto-sell on assignment');
  return parts.join(' · ');
}

export function describeGlobal(id, level) {
  if (id === 'warehouse') return `${Math.round((1 + level * 0.3) * 100)}% storage`;
  if (id === 'training') return `+${Math.round(level * 3)}% crew speed`;
  if (id === 'reputation') return `+${Math.round(level * 6)}% sell price`;
  return '';
}

export function shopStackById(id) {
  return SHOP_STACKS.find((item) => item.id === id);
}

export function supplyFactor(state) {
  let demand = 0;
  for (const def of LINES) {
    const line = state.lines?.[def.id];
    if (!line?.unlocked) continue;
    demand += 1 / Math.max(0.18, getCycleTime(state, def.id, { boost: false }));
  }
  if (demand <= 0) return 1;
  return Math.max(0.4, Math.min(1, (truckDrop(state) / truckInterval(state)) / demand));
}

export function computeOfflineReward(state, seconds) {
  const efficiency = getOfflineEfficiency(state);
  const reward = {
    seconds,
    money: 0,
    xp: 0,
    produced: 0,
    sold: 0,
    stock: {},
    capped: false,
    efficiency,
  };
  for (const def of LINES) {
    const line = state.lines[def.id];
    if (!line?.unlocked) continue;
    const cycle = getCycleTime(state, def.id, { boost: false });
    const price = getSellPrice(state, def.id);
    const cycles = Math.floor((seconds / cycle) * supplyFactor(state));
    if (cycles <= 0) continue;
    const auto = line.autoSell && canAutomate(state, def.id);
    if (auto) {
      const cap = getCapacity(state, def.id);
      const reserved = reservedFor(state, def.id);
      const inventory = line.inventory + (state.pendingOffline?.stock?.[def.id] || 0);
      const space = Math.max(0, cap - inventory);
      const owed = Math.max(0, reserved - inventory);
      const stored = Math.min(cycles, owed, space);
      const blocked = owed > space && cycles >= space;
      const sold = blocked ? 0 : cycles - stored;
      const made = stored + sold;
      if (stored > 0) reward.stock[def.id] = stored;
      reward.produced += made;
      reward.xp += made * def.tier * 0.55;
      reward.money += sold * price * efficiency;
      reward.sold += sold;
    } else {
      reward.produced += cycles;
      reward.xp += cycles * def.tier * 0.55;
      const cap = getCapacity(state, def.id);
      const space = Math.max(0, cap - line.inventory);
      const stored = Math.min(space, cycles);
      const overflow = cycles - stored;
      if (stored > 0) reward.stock[def.id] = stored;
      if (overflow > 0) {
        reward.money += overflow * price * efficiency * 0.5;
        reward.sold += overflow;
        reward.capped = true;
      }
    }
  }
  reward.money = Math.max(0, reward.money);
  reward.xp = Math.floor(reward.xp);
  return reward;
}
