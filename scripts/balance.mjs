import { createInitialState } from '../src/game/state.js';
import { LINES } from '../src/data/content.js';
import { doBuyLineUpgrade, doClaimMission, doCompleteOrder, doSellAll, doSetAutoSell, tick } from '../src/game/engine.js';
import { getFactoryRates, getOfflineEfficiency, lineUpgradeCost } from '../src/utils/economy.js';
import { getLevelInfo, xpForLevel } from '../src/utils/progression.js';
import { formatMoney } from '../src/utils/formatter.js';

function run(seconds, state, step = 0.5) {
  let current = state;
  const ticks = Math.ceil(seconds / step);
  for (let i = 0; i < ticks; i += 1) {
    const result = tick(current, (current.lastTick || Date.now()) + step * 1000);
    current = result.state;
    if (!Number.isFinite(current.money) || current.money < 0) {
      throw new Error(`Money broke at t=${i * step}: ${current.money}`);
    }
  }
  return current;
}

function cashIn(state) {
  let current = state;
  for (const order of state.orders) {
    if ((current.lines[order.lineId]?.inventory || 0) >= order.qty) current = doCompleteOrder(current, order.id).state;
  }
  return doSellAll(current).state;
}

let state = createInitialState(1_700_000_000_000);
state = run(45, state);
const produced = state.totalProduced;
if (produced < 10) throw new Error(`Expected shoes to be produced, got ${produced}`);
state = cashIn(state);
if (state.money <= 0) throw new Error('Selling stock did not pay');
const afterSell = state.money;

let guard = 0;
while (guard < 12) {
  const next = doBuyLineUpgrade(state, 'shoes', 'speed');
  if (next.events.some((event) => event.type === 'deny')) break;
  state = next.state;
  guard += 1;
}
if (state.lines.shoes.speed < 1) throw new Error('Could not buy a speed upgrade');

state = run(80, state);
state = cashIn(state);
const level = getLevelInfo(state.totalXp).level;
let automation = doBuyLineUpgrade(state, 'shoes', 'automation');
if (level < 2) {
  state.totalXp = Math.max(state.totalXp, xpForLevel(1));
  automation = doBuyLineUpgrade(state, 'shoes', 'automation');
}
if (automation.events.some((event) => event.type === 'deny')) {
  throw new Error(automation.events.map((event) => event.message).join(' '));
}
state = automation.state;
if (!state.lines.shoes.autoSell) throw new Error('Automation did not enable auto-sell');

const before = state.money;
state = run(30, state);
const rates = getFactoryRates(state);
if (rates.auto <= 0) throw new Error('Auto income is zero');
if (state.money <= before) throw new Error('Auto-sell did not increase cash');

const offlineFrom = { ...state, lastTick: state.lastTick - 3600 * 1000 };
const away = tick(offlineFrom, offlineFrom.lastTick + 3600 * 1000);
if (!away.state.pendingOffline || away.state.pendingOffline.money <= 0) {
  throw new Error('Offline earnings were not created');
}

// Active play on one line: check in every 5s, deliver, claim the daily sheet, sell free stock,
// then buy the auto-seller when it opens or the cheapest line rank.
const LINE_KEYS = ['speed', 'conveyor', 'value', 'capacity'];

function denied(result) {
  return result.events.some((event) => event.type === 'deny');
}

function checkIn(current, keys) {
  let next = current;
  for (const order of next.orders) {
    if ((next.lines[order.lineId]?.inventory || 0) >= order.qty) next = doCompleteOrder(next, order.id).state;
  }
  for (const mission of next.daily?.missions || []) {
    if (!mission.claimed && mission.progress >= mission.goal) next = doClaimMission(next, mission.id).state;
  }
  const sold = doSellAll(next);
  if (!denied(sold)) next = sold.state;
  for (let guard = 0; guard < 20; guard += 1) {
    const line = next.lines.shoes;
    let choice = null;
    if ((line.automation || 0) < 1 && getLevelInfo(next.totalXp).level >= 2) {
      choice = 'automation';
    } else {
      choice = keys
        .map((key) => ({ key, cost: lineUpgradeCost(LINES[0], key, line[key] || 0) }))
        .sort((a, b) => a.cost - b.cost)[0].key;
    }
    const bought = doBuyLineUpgrade(next, 'shoes', choice);
    if (denied(bought)) break;
    next = bought.state;
  }
  if ((next.lines.shoes.automation || 0) >= 1 && !next.lines.shoes.autoSell) next = doSetAutoSell(next, 'shoes', true).state;
  return next;
}

function snapshot(current, seconds) {
  const info = getLevelInfo(current.totalXp);
  const line = current.lines.shoes;
  return {
    minutes: Math.round(seconds / 60),
    money: current.money,
    earned: current.totalEarned,
    level: info.level,
    xp: Math.floor(current.totalXp),
    rate: getFactoryRates(current).lines.shoes.perSec,
    ranks: `spd ${line.speed} belt ${line.conveyor} qual ${line.value} crate ${line.capacity} auto ${line.automation}`,
  };
}

const clock = (seconds) => (seconds == null ? 'not reached' : `${Math.floor(seconds / 60)}m ${seconds % 60}s`);

function activePlay(keys, seconds) {
  let sim = createInitialState(Date.now());
  sim.tutorialStep = 3;
  const checkpoints = new Set([60, 300, 600, 900, 1800, 3600, 7200, 14400, 21600]);
  const marks = { firstSpeed: null, level2: null, level5: null, tees: null };
  const report = [];
  for (let second = 1; second <= seconds; second += 1) {
    sim = tick(sim, sim.lastTick + 1000).state;
    if (second % 5 === 0) sim = checkIn(sim, keys);
    const level = getLevelInfo(sim.totalXp).level;
    if (marks.firstSpeed == null && sim.lines.shoes.speed >= 1) marks.firstSpeed = second;
    if (marks.level2 == null && level >= 2) marks.level2 = second;
    if (marks.level5 == null && level >= 5) marks.level5 = second;
    if (marks.tees == null && sim.money >= LINES[1].unlockCost) marks.tees = second;
    if (checkpoints.has(second)) report.push(snapshot(sim, second));
  }
  return { marks, report };
}

function printPlay(title, play) {
  const { marks, report } = play;
  console.log(`${title}: first speed rank ${clock(marks.firstSpeed)}, level 2 ${clock(marks.level2)}, level 5 ${clock(marks.level5)}, $${LINES[1].unlockCost} on hand ${clock(marks.tees)}`);
  for (const entry of report) {
    console.log(`  ${String(entry.minutes).padStart(3)}m  cash ${formatMoney(entry.money).padStart(7)}  earned ${formatMoney(entry.earned).padStart(7)}  L${entry.level} (${entry.xp} xp)  ${formatMoney(entry.rate)}/s  ${entry.ranks}`);
  }
}

const speedOnly = activePlay(['speed'], 21600);
const allRanks = activePlay(LINE_KEYS, 21600);
console.log(`First sell purse: ${formatMoney(afterSell)}`);
console.log(`Offline efficiency: ${Math.round(getOfflineEfficiency(createInitialState(Date.now())) * 100)}% on a fresh mill`);
printPlay('Speed ranks only', speedOnly);
printPlay('Every line rank', allRanks);

for (const [title, play] of [['speed-only', speedOnly], ['all-ranks', allRanks]]) {
  const ten = play.report.find((entry) => entry.minutes === 10);
  if (play.marks.firstSpeed == null || play.marks.firstSpeed > 120) throw new Error(`${title}: first sell did not pay for a speed rank in time`);
  if (ten.level > 2) throw new Error(`${title}: level ${ten.level} after ten minutes`);
  if (ten.earned > 8000) throw new Error(`${title}: ${formatMoney(ten.earned)} earned in ten minutes`);
  if (play.marks.level2 == null || play.marks.level2 < 300) throw new Error(`${title}: level 2 came at ${clock(play.marks.level2)}`);
  if (play.marks.level5 != null && play.marks.level5 < 5400) throw new Error(`${title}: level 5 in ${clock(play.marks.level5)}`);
}

console.log('Balance check passed');
console.log(`Speed ranks: ${state.lines.shoes.speed}`);
console.log(`Level: ${getLevelInfo(state.totalXp).level}`);
console.log(`Auto income: ${formatMoney(rates.auto)}/s`);
console.log(`30s auto cash gain: ${formatMoney(state.money - before)}`);
console.log(`1h offline: ${formatMoney(away.state.pendingOffline.money)} at ${Math.round(away.state.pendingOffline.efficiency * 100)}%`);
