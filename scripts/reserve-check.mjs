import { createInitialState } from '../src/game/state.js';
import { sanitize } from '../src/utils/storage.js';
import { doCompleteOrder, doLoadContract, doSellAll, doSellLine, tick } from '../src/game/engine.js';
import { computeOfflineReward, getCapacity, getLineStats } from '../src/utils/economy.js';
import { bottleneckFix, freeStock, reservedFor } from '../src/utils/growth.js';

const FAR = Date.now() + 1e10;

function run(seconds, state, step = 0.5) {
  let current = state;
  for (let i = 0; i < Math.ceil(seconds / step); i += 1) {
    current = tick(current, (current.lastTick || Date.now()) + step * 1000).state;
  }
  return current;
}

function deny(result) {
  return result.events.some((event) => event.type === 'deny');
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function order(lineId, qty, id = `t-${qty}`) {
  return { id, type: 'standard', lineId, qty, reward: 500, xp: 5, deadline: null, createdAt: Date.now(), title: 'Test ticket', customer: 'Test Co', difficulty: 'Easy' };
}

function autoFactory() {
  const state = createInitialState(Date.now());
  state.tutorialStep = 3;
  state.lines.shoes.automation = 1;
  state.lines.shoes.autoSell = true;
  state.lines.shoes.inventory = 0;
  state.orders = [];
  state.contracts = [];
  state.nextOrderFillAt = FAR;
  state.nextContractAt = FAR;
  state.materials = 60;
  state.materialTimer = 0;
  return state;
}

// An auto line fills to the order, then street-sells the extra.
let state = autoFactory();
state.orders = [order('shoes', 5)];
const moneyBefore = state.money;
state = run(120, state);
check(state.lines.shoes.inventory === 5, `Auto line should hold 5 for the order, has ${state.lines.shoes.inventory}`);
check(state.money > moneyBefore, 'Extra output was not street-sold');
check(state.lines.shoes.sold > 0, 'Street sales were not counted');
check(getLineStats(state, 'shoes').free === 0, 'Held stock should not be free');

// Deliver works without turning auto-sell off.
const delivered = doCompleteOrder(state, state.orders[0].id);
check(!deny(delivered), 'Delivery failed with auto-sell on');
state = delivered.state;
check(state.lines.shoes.autoSell, 'Delivery turned auto-sell off');
check(state.lines.shoes.inventory === 0, 'Delivery did not subtract the order');

// While stocking, production goes to the crate and the bottleneck reads as stocking.
state.orders = [order('shoes', 4)];
state.lines.shoes.raw = 3;
state.lines.shoes.wip = 3;
state.lines.shoes.condition = 100;
check(getLineStats(state, 'shoes').bottleneck === 'Stocking order', `Expected stocking, got ${getLineStats(state, 'shoes').bottleneck}`);
check(bottleneckFix(state, 'shoes', 'Stocking order') === 'orders', 'Stocking an order should open orders');

// Sell all leaves reserved units; manual sell refuses when nothing is free.
state = autoFactory();
state.lines.shoes.autoSell = false;
state.orders = [order('shoes', 5)];
state.lines.shoes.inventory = 12;
const sold = doSellAll(state);
check(!deny(sold), 'Sell all failed with free stock');
state = sold.state;
check(state.lines.shoes.inventory === 5, `Sell all should leave 5, left ${state.lines.shoes.inventory}`);
const refused = doSellLine(state, 'shoes');
check(deny(refused), 'Selling held stock should be refused');
check(refused.state.lines.shoes.inventory === 5, 'Refused sell changed the crate');
check(deny(doSellAll(state)), 'Sell all should refuse when everything is held');

// A dock contract reserves the same way.
state = autoFactory();
state.contracts = [{ id: 'c-1', customer: 'Dock Co', lineId: 'shoes', qty: 6, loaded: 2, reward: 300 }];
check(reservedFor(state, 'shoes') === 4, 'Contract reservation should be qty - loaded');
state = run(120, state);
check(state.lines.shoes.inventory === 4, `Contract should hold 4, has ${state.lines.shoes.inventory}`);
const loaded = doLoadContract(state, 'c-1');
check(!deny(loaded), 'Loading the contract failed');
check((loaded.state.contractsCompleted || 0) >= 1, 'Contract did not complete');

// Reserved stock larger than the crate stalls at capacity instead of selling.
state = autoFactory();
const cap = getCapacity(state, 'shoes');
state.orders = [order('shoes', cap + 4)];
const stallMoney = state.money;
state = run(240, state);
const full = getLineStats(state, 'shoes');
check(state.lines.shoes.inventory === cap, `Crate should stop at ${cap}, has ${state.lines.shoes.inventory}`);
check(full.stalled && full.bottleneck === 'Crate full', 'Over-reserved crate should read as full');
check(state.money === stallMoney, 'A stalled reserved crate should not street-sell');
check(bottleneckFix(state, 'shoes', 'Crate full') === 'orders', 'Full held crate should open orders');

// Offline accrual follows the same rule.
state = autoFactory();
state.orders = [order('shoes', 6)];
const offline = computeOfflineReward(state, 3600);
check(offline.stock.shoes === 6, `Offline should stock 6, stocked ${offline.stock.shoes}`);
check(offline.money > 0 && offline.sold === offline.produced - 6, 'Offline should street-sell the rest');
state.orders = [order('shoes', cap + 10)];
const offlineStall = computeOfflineReward(state, 3600);
check(offlineStall.stock.shoes === cap && offlineStall.money === 0, 'Offline should stall when reserved exceeds the crate');
state.orders = [];
const offlineFree = computeOfflineReward(state, 3600);
check(!offlineFree.stock.shoes && offlineFree.sold === offlineFree.produced, 'Offline without orders should sell everything');

// Panel targets.
check(bottleneckFix(state, 'shoes', 'Need raw') === 'logistics', 'Raw should open logistics');
check(bottleneckFix(state, 'shoes', 'Needs service') === 'robotics', 'Wear should open robotics');
state.lines.shoes.inventory = 3;
check(bottleneckFix(state, 'shoes', 'Crate full') === 'warehouse', 'Free stock in a full crate should open warehouse');

// An old save loads and derives reservations.
const migrated = sanitize({ version: 1, money: 12, lines: { shoes: { unlocked: true, inventory: 3 } } });
check(migrated.lines.shoes.inventory === 3, 'Old inventory was lost');
check(freeStock(migrated, 'shoes') === 3 - reservedFor(migrated, 'shoes') || reservedFor(migrated, 'shoes') >= 3, 'Free stock wrong on old save');
check(getLineStats(migrated, 'shoes').bottleneck, 'Old save has no bottleneck');
check(!('reserved' in migrated.lines.shoes), 'Reserved must not be stored');

console.log('Reserve check passed');
