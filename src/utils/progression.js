import { LINES } from '../data/content.js';

export function xpForLevel(level) {
  return Math.floor(640 * Math.pow(Math.max(1, level), 1.72));
}

export function getLevelInfo(totalXp) {
  let level = 1;
  let rest = Math.max(0, Number(totalXp) || 0);
  for (let guard = 0; guard < 500; guard += 1) {
    const need = xpForLevel(level);
    if (rest < need) {
      return { level, into: rest, need, totalXp: Math.max(0, Number(totalXp) || 0) };
    }
    rest -= need;
    level += 1;
  }
  const need = xpForLevel(level);
  return { level, into: rest, need, totalXp: Math.max(0, Number(totalXp) || 0) };
}

export function grantXp(state, amount, events) {
  const gain = Number(amount) || 0;
  if (gain <= 0) return getLevelInfo(state.totalXp);
  const before = getLevelInfo(state.totalXp).level;
  state.totalXp += gain;
  const after = getLevelInfo(state.totalXp);
  if (after.level > before) {
    events.push({
      type: 'levelup',
      level: after.level,
      gained: after.level - before,
    });
    for (const def of LINES) {
      if (def.unlockLevel > before && def.unlockLevel <= after.level) {
        events.push({
          type: 'line-available',
          lineId: def.id,
          product: def.product,
          level: def.unlockLevel,
        });
      }
    }
  }
  return after;
}

export function maxOrderSlots(level) {
  return level < 4 ? 2 : 3;
}
