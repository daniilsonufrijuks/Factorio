import { LINE_MAP, LINES, SHOP_STACKS, THEME_SHOP } from '../../data/content.js';
import {
  canAutomate,
  computeOfflineReward,
  getCapacity,
  getCycleTime,
  getMaxOfflineSeconds,
  getSellPrice,
  stackCost,
  surgeReward,
  whistleCost,
} from '../../utils/economy.js';
import { grantXp } from '../../utils/progression.js';
import { noteProgress } from '../../utils/progressHooks.js';

function fail(reason) {
  return { ok: false, reason };
}

export function sellLine(state, events, lineId) {
  const line = state.lines[lineId];
  const def = LINE_MAP[lineId];
  if (!line?.unlocked || !def) return fail('That line is not open.');
  if (line.inventory <= 0) return fail('The crate is empty.');
  const count = line.inventory;
  const money = count * getSellPrice(state, lineId);
  line.inventory = 0;
  line.sold += count;
  state.totalSold += count;
  state.money += money;
  state.totalEarned += money;
  noteProgress(state, 'earn', money);
  grantXp(state, count * def.tier, events);
  if (state.tutorialStep < 2) state.tutorialStep = 2;
  events.push({ type: 'sell', lineId, money, count, manual: true });
  return { ok: true };
}

export function sellAll(state, events) {
  let sold = false;
  for (const def of LINES) {
    if ((state.lines[def.id]?.inventory || 0) > 0) {
      const result = sellLine(state, events, def.id);
      if (result.ok) sold = true;
    }
  }
  if (!sold) return fail('Nothing in storage yet.');
  return { ok: true };
}

export function setAutoSell(state, events, lineId, enabled) {
  const line = state.lines[lineId];
  if (!line?.unlocked) return fail('That line is not open.');
  if (enabled && !canAutomate(state, lineId)) {
    return fail('Install an auto-seller or assign a manager first.');
  }
  line.autoSell = Boolean(enabled);
  events.push({
    type: 'mode',
    lineId,
    auto: line.autoSell,
    message: line.autoSell ? 'Auto-sell is on for this line.' : 'Goods will wait in the crate.',
  });
  return { ok: true };
}

export function tapLine(state, events, lineId, now) {
  const line = state.lines[lineId];
  if (!line?.unlocked) return fail('That line is not open.');
  if (now - (line.lastTap || 0) < 320) return { ok: true };
  line.lastTap = now;
  line.progress += getCycleTime(state, lineId) * 0.55;
  events.push({ type: 'tap', lineId });
  return { ok: true };
}

export function buyStack(state, events, itemId) {
  const item = SHOP_STACKS.find((entry) => entry.id === itemId);
  if (!item) return fail('That contract is gone.');
  const owned = state.shop[item.id] || 0;
  if (owned >= item.max) return fail('That contract is maxed.');
  const cost = stackCost(item, owned);
  if (state.money < cost) return fail('Not enough cash.');
  state.money -= cost;
  state.totalSpent = (state.totalSpent || 0) + cost;
  state.shop[item.id] = owned + 1;
  state.upgradesBought += 1;
  grantXp(state, 8 + owned, events);
  events.push({ type: 'upgrade', message: `${item.name} signed.` });
  return { ok: true };
}

export function buyTheme(state, events, themeId) {
  const item = THEME_SHOP.find((entry) => entry.id === themeId);
  if (!item) return fail('Unknown enamel.');
  if (state.shop.ownedThemes.includes(themeId)) {
    state.shop.theme = themeId;
    events.push({ type: 'mode', message: `${item.name} is on the floor.` });
    return { ok: true };
  }
  if (state.money < item.cost) return fail('Not enough cash.');
  state.money -= item.cost;
  state.totalSpent = (state.totalSpent || 0) + item.cost;
  state.shop.ownedThemes = [...state.shop.ownedThemes, themeId];
  state.shop.theme = themeId;
  state.upgradesBought += 1;
  grantXp(state, 20, events);
  events.push({ type: 'unlock', message: `${item.name} is on the floor.` });
  return { ok: true };
}

export function equipTheme(state, events, themeId) {
  if (!state.shop.ownedThemes.includes(themeId) && themeId !== 'dusk') {
    return fail('Buy that enamel first.');
  }
  state.shop.theme = themeId === 'dusk' || state.shop.ownedThemes.includes(themeId) ? themeId : 'dusk';
  events.push({ type: 'mode', message: 'Floor paint updated.' });
  return { ok: true };
}

export function buyWhistle(state, events, now) {
  const cost = whistleCost(state);
  if (state.money < cost) return fail('Not enough cash for overtime.');
  state.money -= cost;
  state.totalSpent = (state.totalSpent || 0) + cost;
  const start = Math.max(now, state.shop.boostUntil || 0);
  state.shop.boostUntil = start + 180000;
  events.push({ type: 'upgrade', message: 'Overtime whistle: double speed for 3 minutes.' });
  return { ok: true };
}

export function claimSurge(state, events, now) {
  const readyAt = (state.shop.surgeAt || 0) + 300000;
  if (now < readyAt) return fail('The surge buyer is still out.');
  const reward = surgeReward(state);
  state.money += reward;
  state.totalEarned += reward;
  state.shop.surgeAt = now;
  grantXp(state, 6, events);
  events.push({ type: 'surge', money: reward });
  return { ok: true };
}

export function accrueOffline(state, gapSeconds, now, events) {
  const maxSeconds = getMaxOfflineSeconds(state);
  const already = state.pendingOffline?.seconds || 0;
  const room = Math.max(0, maxSeconds - already);
  const used = Math.min(Math.max(0, gapSeconds), room);
  state.lastTick = now;
  if (used < 1) return { ok: true };
  const reward = computeOfflineReward(state, used);
  reward.hitCap = gapSeconds > room + 0.5 || Boolean(state.pendingOffline?.hitCap);
  reward.seconds = used + already;
  if (state.pendingOffline) {
    const previous = state.pendingOffline;
    const stock = { ...previous.stock };
    for (const [id, count] of Object.entries(reward.stock)) {
      stock[id] = (stock[id] || 0) + count;
    }
    state.pendingOffline = {
      ...reward,
      money: previous.money + reward.money,
      xp: previous.xp + reward.xp,
      produced: previous.produced + reward.produced,
      sold: previous.sold + reward.sold,
      stock,
      capped: previous.capped || reward.capped,
      hitCap: previous.hitCap || reward.hitCap,
      efficiency: reward.efficiency,
    };
  } else if (reward.produced > 0 || reward.money > 0) {
    state.pendingOffline = reward;
  }
  state.offlineSeconds += used;
  if (state.pendingOffline) events.push({ type: 'offline-ready' });
  return { ok: true };
}

export function collectOffline(state, events) {
  const pending = state.pendingOffline;
  if (!pending) return fail('Nothing is waiting.');
  state.money += pending.money;
  state.totalEarned += pending.money;
  state.totalProduced += pending.produced;
  state.totalSold += pending.sold;
  for (const [lineId, count] of Object.entries(pending.stock || {})) {
    const line = state.lines[lineId];
    if (!line) continue;
    const room = Math.max(0, getCapacity(state, lineId) - line.inventory);
    line.inventory += Math.min(room, count);
  }
  grantXp(state, pending.xp, events);
  state.pendingOffline = null;
  events.push({ type: 'offline-collect', money: pending.money, pending });
  return { ok: true };
}

export function dismissTutorial(state) {
  state.tutorialStep = 3;
  return { ok: true };
}

export function patchSettings(state, events, partial) {
  state.settings = { ...state.settings, ...partial };
  if (partial.quality && !['high', 'medium', 'low'].includes(state.settings.quality)) {
    state.settings.quality = 'high';
  }
  events.push({ type: 'settings' });
  return { ok: true };
}
