import { LINE_MAP, LINES } from '../../data/content.js';
import { ACHIEVEMENTS, RESEARCH_MAP, ROOM_MAP, ROOMS } from '../../data/growth.js';
import { makeStarterOrder } from '../state.js';
import { getSellPrice } from '../../utils/economy.js';
import { getLevelInfo } from '../../utils/progression.js';
import {
  buildMissions,
  canPrestige,
  crewCost,
  dayKey,
  forkliftCost,
  missionReward,
  palletCost,
  prestigeGain,
  prestigeUpgradeCost,
  repairCost,
  roomForLine,
  slotCost,
  truckCost,
  materialCap,
} from '../../utils/growth.js';
import { noteProgress } from '../../utils/progressHooks.js';
import { grantXp } from '../../utils/progression.js';

function fail(reason) {
  return { ok: false, reason };
}

function spend(state, cost) {
  if (state.money < cost) return false;
  state.money -= cost;
  state.totalSpent = (state.totalSpent || 0) + cost;
  return true;
}

export function buyRoom(state, events, roomId) {
  const room = ROOM_MAP[roomId];
  const owned = state.rooms?.[roomId];
  if (!room || !owned) return fail('Unknown room.');
  if (owned.owned) return fail('That room is already open.');
  const level = getLevelInfo(state.totalXp).level;
  if (level < room.level) return fail(`Reach level ${room.level} to open ${room.name}.`);
  if (room.cost > 0 && !spend(state, room.cost)) return fail('Not enough cash.');
  owned.owned = true;
  grantXp(state, 24 + room.level * 4, events);
  events.push({ type: 'room', message: `${room.name} is part of the works.` });
  return { ok: true };
}

export function buySlot(state, events, roomId) {
  const room = ROOM_MAP[roomId];
  const owned = state.rooms?.[roomId];
  if (!room || !owned?.owned) return fail('Open that room first.');
  if ((owned.slots || 0) >= 4) return fail('That room has no open machine bays.');
  const cost = slotCost(room, owned.slots || 0);
  if (!spend(state, cost)) return fail('Not enough cash.');
  owned.slots = (owned.slots || 0) + 1;
  state.upgradesBought += 1;
  events.push({ type: 'upgrade', message: `${room.name} has ${1 + owned.slots} machine bays.` });
  return { ok: true };
}

export function buyResearch(state, events, techId) {
  const tech = RESEARCH_MAP[techId];
  if (!tech) return fail('Unknown research.');
  if (state.research.unlocked.includes(tech.id)) return fail('Already researched.');
  if (tech.requires && !state.research.unlocked.includes(tech.requires)) {
    return fail(`Research ${RESEARCH_MAP[tech.requires]?.name || 'the previous project'} first.`);
  }
  if ((state.research.points || 0) < tech.cost) return fail('Not enough research points.');
  state.research.points -= tech.cost;
  state.research.unlocked.push(tech.id);
  noteProgress(state, 'research', 1);
  events.push({ type: 'research', message: `${tech.name} is on the floor for good.` });
  return { ok: true };
}

export function buyForklifts(state, events) {
  const rank = state.logistics.forklifts || 0;
  if (rank >= 8) return fail('The yard is full of forklifts.');
  const cost = forkliftCost(rank);
  if (!spend(state, cost)) return fail('Not enough cash.');
  state.logistics.forklifts = rank + 1;
  events.push({ type: 'upgrade', message: `Forklift crew is rank ${state.logistics.forklifts}.` });
  return { ok: true };
}

export function buyTrucks(state, events) {
  const rank = state.logistics.trucks || 0;
  if (rank >= 6) return fail('The dock schedule is full.');
  const cost = truckCost(rank);
  if (!spend(state, cost)) return fail('Not enough cash.');
  state.logistics.trucks = rank + 1;
  events.push({ type: 'upgrade', message: `Delivery trucks are rank ${state.logistics.trucks}.` });
  return { ok: true };
}

export function buyCrew(state, events) {
  const rank = state.maintenanceCrew || 0;
  if (rank >= 8) return fail('The maintenance bench is fully staffed.');
  const cost = crewCost(rank);
  if (!spend(state, cost)) return fail('Not enough cash.');
  state.maintenanceCrew = rank + 1;
  events.push({ type: 'upgrade', message: `Maintenance crew is rank ${state.maintenanceCrew}.` });
  return { ok: true };
}

export function buyPallet(state, events) {
  const cost = palletCost(state);
  if (!spend(state, cost)) return fail('Not enough cash.');
  state.materials = Math.min(materialCap(state), (state.materials || 0) + 15);
  events.push({ type: 'upgrade', message: 'A raw pallet is in the yard.' });
  return { ok: true };
}

export function repairLine(state, events, lineId) {
  const line = state.lines[lineId];
  const def = LINE_MAP[lineId];
  if (!line?.unlocked || !def) return fail('That line is not open.');
  if ((line.condition ?? 100) >= 99) return fail('That machine does not need service.');
  const cost = repairCost(getSellPrice(state, lineId), line.condition ?? 100);
  if (!spend(state, cost)) return fail('Not enough cash.');
  line.condition = 100;
  line.wearNotified = false;
  state.everRepaired = true;
  noteProgress(state, 'repair', 1);
  events.push({ type: 'repair', lineId, message: `${def.short} is back to full condition.` });
  return { ok: true };
}

export function loadContract(state, events, contractId) {
  const contract = (state.contracts || []).find((entry) => entry.id === contractId);
  if (!contract) return fail('That truck already left.');
  const line = state.lines[contract.lineId];
  const def = LINE_MAP[contract.lineId];
  if (!line || !def) return fail('That product line is closed.');
  const need = contract.qty - contract.loaded;
  if (need <= 0) return fail('That truck is already full.');
  if (line.inventory <= 0) return fail('The crate is empty.');
  const moved = Math.min(line.inventory, need);
  line.inventory -= moved;
  line.sold += moved;
  state.totalSold += moved;
  contract.loaded += moved;
  if (contract.loaded < contract.qty) {
    events.push({ type: 'upgrade', message: `Loaded ${contract.loaded}/${contract.qty} for ${contract.customer}.` });
    return { ok: true };
  }
  state.money += contract.reward;
  state.totalEarned += contract.reward;
  state.contractsCompleted = (state.contractsCompleted || 0) + 1;
  state.contracts = state.contracts.filter((entry) => entry.id !== contractId);
  noteProgress(state, 'earn', contract.reward);
  grantXp(state, Math.max(4, def.tier * contract.qty), events);
  events.push({ type: 'contract', message: `${contract.customer} paid for the ${def.short.toLowerCase()} run.` });
  return { ok: true };
}

export function claimMission(state, events, missionId) {
  const mission = state.daily?.missions?.find((entry) => entry.id === missionId);
  if (!mission) return fail('That job is not on today\'s sheet.');
  if (mission.claimed) return fail('Already collected.');
  if ((mission.progress || 0) < mission.goal) return fail('That job is not finished.');
  const reward = missionReward(state);
  mission.claimed = true;
  state.money += reward.money;
  state.totalEarned += reward.money;
  state.research.points += reward.points;
  grantXp(state, reward.xp, events);
  events.push({ type: 'mission', message: `${mission.label} paid ${reward.money} and ${reward.points} research.` });
  return { ok: true };
}

export function buyPrestigeUpgrade(state, events, key) {
  if (!['speed', 'yield', 'care'].includes(key)) return fail('Unknown prestige upgrade.');
  const rank = state.prestige[key] || 0;
  if (rank >= 20) return fail('That prestige bonus is maxed.');
  const cost = prestigeUpgradeCost(rank);
  if ((state.prestige.points || 0) < cost) return fail('Not enough prestige.');
  state.prestige.points -= cost;
  state.prestige[key] = rank + 1;
  events.push({ type: 'upgrade', message: `Prestige ${key} is rank ${state.prestige[key]}.` });
  return { ok: true };
}

export function prestigeRun(state, events) {
  if (!canPrestige(state)) return fail('Reach level 10 or $25K lifetime earnings before prestiging.');
  const gain = prestigeGain(state);
  state.prestige.points += gain;
  state.prestige.runs += 1;
  resetRun(state);
  events.push({ type: 'prestige', message: `The works start again. +${gain} prestige.` });
  return { ok: true };
}

export function housekeeping(state, events, now) {
  rollDaily(state, now);
  offerContracts(state, now, events);
  evaluateAchievements(state, events);
}

function rollDaily(state, now) {
  const key = dayKey(now);
  if (state.daily?.day === key && Array.isArray(state.daily.missions)) return;
  state.daily = { day: key, missions: buildMissions(state, now) };
}

function offerContracts(state, now, events) {
  if (!Array.isArray(state.contracts)) state.contracts = [];
  state.contracts = state.contracts.filter((contract) => LINE_MAP[contract.lineId]);
  if (state.contracts.length >= 2) return;
  if (now < (state.nextContractAt || 0)) return;
  const open = LINES.filter((def) => state.lines[def.id]?.unlocked);
  if (!open.length) return;
  const def = open[Math.floor(Math.random() * open.length)];
  const price = getSellPrice(state, def.id);
  const qty = 4 + Math.min(12, state.prestige?.runs || 0);
  const truckBonus = 1.35 + (state.logistics?.trucks || 0) * 0.08 + (state.rooms?.shipping?.owned ? 0.15 : 0);
  state.contractSeq = (state.contractSeq || 1) + 1;
  state.contracts.push({
    id: `con-${state.contractSeq}`,
    lineId: def.id,
    qty,
    loaded: 0,
    reward: Math.ceil(qty * price * truckBonus),
    customer: 'Riverton Dispatch',
  });
  state.nextContractAt = now + 50000;
  events.push({ type: 'contract-new', message: `${def.short} delivery is waiting at the dock.` });
}

function evaluateAchievements(state, events) {
  const checks = {
    'first-sale': (state.totalSold || 0) >= 1,
    hundred: (state.totalProduced || 0) >= 100,
    thousand: (state.totalProduced || 0) >= 1000,
    'orders-5': (state.ordersCompleted || 0) >= 5,
    'room-assembly': Boolean(state.rooms?.assembly?.owned),
    scholar: (state.research?.unlocked?.length || 0) >= 3,
    repaired: Boolean(state.everRepaired),
    hauler: (state.contractsCompleted || 0) >= 1,
    'prestige-once': (state.prestige?.runs || 0) >= 1,
  };
  for (const achievement of ACHIEVEMENTS) {
    if (state.achievements?.[achievement.id]) continue;
    if (!checks[achievement.id]) continue;
    state.achievements[achievement.id] = true;
    state.money += achievement.money;
    state.totalEarned += achievement.money;
    state.research.points += achievement.points;
    grantXp(state, achievement.xp, events);
    events.push({ type: 'achievement', message: `${achievement.name}: ${achievement.blurb}` });
  }
}

function resetRun(state) {
  const now = Date.now();
  state.money = 0;
  for (const def of LINES) {
    const unlocked = def.id === 'shoes';
    state.lines[def.id] = {
      unlocked,
      speed: 0,
      conveyor: 0,
      value: 0,
      capacity: 0,
      automation: 0,
      inventory: 0,
      progress: 0,
      autoSell: false,
      produced: state.lines[def.id]?.produced || 0,
      sold: state.lines[def.id]?.sold || 0,
      lastTap: 0,
      raw: unlocked ? 2 : 0,
      wip: unlocked ? 2 : 0,
      intakeProgress: 0,
      formProgress: 0,
      condition: 100,
      wearNotified: false,
    };
  }
  state.upgrades = { warehouse: 0, training: 0, reputation: 0 };
  state.shop.brand = 0;
  state.shop.overclock = 0;
  state.shop.night = 0;
  state.shop.slots = 0;
  state.shop.surgeAt = 0;
  state.shop.boostUntil = 0;
  state.employees = [];
  state.orders = [makeStarterOrder(now)];
  state.orderSeq = 2;
  state.nextOrderFillAt = now + 25000;
  state.materials = 40;
  state.materialTimer = 0;
  state.logistics = { forklifts: 0, trucks: 0 };
  state.contracts = [];
  state.nextContractAt = now + 40000;
  state.maintenanceCrew = 0;
  for (const room of ROOMS) {
    state.rooms[room.id] = { owned: room.id === 'cutting', slots: 0 };
  }
  if (state.tutorialStep < 3) state.tutorialStep = 0;
}

export function lineRoomOpen(state, lineId) {
  const room = roomForLine(lineId);
  return Boolean(state.rooms?.[room.id]?.owned);
}
