import { CUSTOMERS, LINE_MAP, LINES, ORDER_TITLES } from '../../data/content.js';
import { getCapacity, getCycleTime, getSellPrice } from '../../utils/economy.js';
import { getLevelInfo, grantXp, maxOrderSlots } from '../../utils/progression.js';
import { noteProgress } from '../../utils/progressHooks.js';

const TYPES = [
  { id: 'standard', weight: 52, seconds: 42, mult: 1.9, xp: 1.4 },
  { id: 'bulk', weight: 24, seconds: 110, mult: 2.4, xp: 1.8, minLevel: 2 },
  { id: 'premium', weight: 14, seconds: 70, mult: 3.35, xp: 2.3, minLevel: 4 },
  { id: 'timed', weight: 14, seconds: 30, mult: 2.75, xp: 2, minLevel: 3 },
];

function fail(reason) {
  return { ok: false, reason };
}

function pick(list) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return list[0];
}

function pickWeightedLine(state) {
  const unlocked = LINES.filter((line) => state.lines[line.id]?.unlocked);
  const weighted = unlocked.map((line, index) => ({ line, weight: index + 1 }));
  return pick(weighted).line;
}

function difficulty(type, qty, capacity) {
  if (type === 'timed') return 'Rush';
  const ratio = qty / Math.max(1, capacity);
  if (ratio < 0.4) return 'Easy';
  if (ratio < 0.72) return 'Medium';
  return 'Heavy';
}

export function createOrder(state, now, forcedType) {
  const level = getLevelInfo(state.totalXp).level;
  const pool = TYPES.filter((type) => !type.minLevel || level >= type.minLevel);
  const type = forcedType ? TYPES.find((entry) => entry.id === forcedType) || pool[0] : pick(pool);
  const def = pickWeightedLine(state);
  const cycle = Math.max(0.4, getCycleTime(state, def.id, { boost: false }));
  const capacity = getCapacity(state, def.id);
  let qty = Math.round(type.seconds / cycle);
  qty = Math.max(4, Math.min(qty, Math.max(4, Math.floor(capacity * 0.85)), 5000));
  const price = getSellPrice(state, def.id);
  const titles = ORDER_TITLES[type.id];
  const makeSeconds = qty * cycle;
  let deadline = null;
  if (type.id === 'timed') deadline = now + Math.max(90, makeSeconds * 2.4) * 1000;
  if (type.id === 'premium') deadline = now + Math.max(180, makeSeconds * 2.6) * 1000;
  state.orderSeq += 1;
  return {
    id: `ord-${state.orderSeq}`,
    type: type.id,
    lineId: def.id,
    qty,
    reward: Math.ceil(qty * price * type.mult),
    xp: Math.ceil(qty * def.tier * type.xp),
    deadline,
    createdAt: now,
    title: titles[Math.floor(Math.random() * titles.length)],
    customer: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)],
    difficulty: difficulty(type.id, qty, capacity),
  };
}

export function maintain(state, now, events) {
  const before = state.orders.length;
  state.orders = state.orders.filter((order) => {
    if (order.deadline && now >= order.deadline) {
      state.ordersExpired += 1;
      events.push({ type: 'order-expired', id: order.id, title: order.title });
      return false;
    }
    if (!LINE_MAP[order.lineId] || !state.lines[order.lineId]?.unlocked) return false;
    return true;
  });
  if (state.orders.length < before) state.nextOrderFillAt = Math.max(state.nextOrderFillAt, now + 6000);
  const cap = maxOrderSlots(getLevelInfo(state.totalXp).level);
  if (state.orders.length < cap && now >= (state.nextOrderFillAt || 0)) {
    const order = createOrder(state, now);
    state.orders.push(order);
    state.nextOrderFillAt = now + (state.orders.length < cap ? 18000 : 22000);
    if (order.type === 'premium' || order.type === 'timed') {
      events.push({ type: 'order-new', title: order.title, orderType: order.type });
    }
  }
}

export function completeOrder(state, events, orderId) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) return fail('That order already left.');
  const line = state.lines[order.lineId];
  const def = LINE_MAP[order.lineId];
  if (!line || !def) return fail('That product line is closed.');
  if (line.inventory < order.qty) {
    return fail(`Need ${order.qty - line.inventory} more ${def.short.toLowerCase()}.`);
  }
  line.inventory -= order.qty;
  line.sold += order.qty;
  state.totalSold += order.qty;
  state.money += order.reward;
  state.totalEarned += order.reward;
  state.ordersCompleted += 1;
  noteProgress(state, 'orders', 1);
  noteProgress(state, 'earn', order.reward);
  state.orders = state.orders.filter((entry) => entry.id !== orderId);
  state.nextOrderFillAt = Math.max(state.nextOrderFillAt, Date.now() + 5000);
  grantXp(state, order.xp, events);
  events.push({
    type: 'order',
    id: order.id,
    money: order.reward,
    message: `${order.customer} paid ${order.title.toLowerCase()}.`,
  });
  return { ok: true };
}
