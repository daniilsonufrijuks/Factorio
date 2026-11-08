import { createInitialState } from '../src/game/state.js';
import { doBuyLineUpgrade, doCompleteOrder, doSellAll, doSetAutoSell, tick } from '../src/game/engine.js';
import { getFactoryRates } from '../src/utils/economy.js';
import { getLevelInfo } from '../src/utils/progression.js';
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
  state.totalXp += 500;
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

console.log('Balance check passed');
console.log(`First sell purse: ${formatMoney(afterSell)}`);
console.log(`Speed ranks: ${state.lines.shoes.speed}`);
console.log(`Level: ${getLevelInfo(state.totalXp).level}`);
console.log(`Auto income: ${formatMoney(rates.auto)}/s`);
console.log(`30s auto cash gain: ${formatMoney(state.money - before)}`);
console.log(`1h offline: ${formatMoney(away.state.pendingOffline.money)} at ${Math.round(away.state.pendingOffline.efficiency * 100)}%`);
