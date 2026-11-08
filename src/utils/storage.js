import { EMPLOYEE_MAP, LINE_MAP, LINES, SAVE_KEY, THEME_SHOP } from '../data/content.js';
import { RESEARCH, ROOMS } from '../data/growth.js';
import { createInitialState } from '../game/state.js';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizePending(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const stock = {};
  if (raw.stock && typeof raw.stock === 'object') {
    for (const def of LINES) {
      const amount = Math.floor(num(raw.stock[def.id]));
      if (amount > 0) stock[def.id] = amount;
    }
  }
  const pending = {
    seconds: Math.max(0, num(raw.seconds)),
    money: Math.max(0, num(raw.money)),
    xp: Math.max(0, Math.floor(num(raw.xp))),
    produced: Math.max(0, Math.floor(num(raw.produced))),
    sold: Math.max(0, Math.floor(num(raw.sold))),
    stock,
    capped: Boolean(raw.capped),
    efficiency: clamp(num(raw.efficiency, 0.4), 0, 1),
    hitCap: Boolean(raw.hitCap),
  };
  if (pending.seconds < 1 && pending.money <= 0 && pending.produced <= 0) return null;
  return pending;
}

function sanitizeOrder(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!LINE_MAP[raw.lineId]) return null;
  const qty = Math.floor(num(raw.qty));
  if (qty <= 0) return null;
  return {
    id: String(raw.id || `ord-${Math.random().toString(36).slice(2, 8)}`),
    type: ['standard', 'bulk', 'premium', 'timed'].includes(raw.type) ? raw.type : 'standard',
    lineId: raw.lineId,
    qty,
    reward: Math.max(0, num(raw.reward)),
    xp: Math.max(0, Math.floor(num(raw.xp))),
    deadline: raw.deadline ? num(raw.deadline) : null,
    createdAt: num(raw.createdAt, Date.now()),
    title: String(raw.title || 'Customer order').slice(0, 80),
    customer: String(raw.customer || 'Local buyer').slice(0, 60),
    difficulty: String(raw.difficulty || 'Medium').slice(0, 20),
  };
}

function sanitizeDaily(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.missions)) return null;
  const missions = raw.missions.slice(0, 3).map((mission) => {
    if (!mission || typeof mission !== 'object') return null;
    const goal = Math.max(1, Math.floor(num(mission.goal, 1)));
    return {
      id: String(mission.id || 'job').slice(0, 40),
      kind: ['produce', 'earn', 'orders', 'repair', 'research'].includes(mission.kind) ? mission.kind : 'produce',
      goal,
      progress: clamp(num(mission.progress), 0, goal),
      claimed: Boolean(mission.claimed),
      label: String(mission.label || 'Daily job').slice(0, 80),
    };
  }).filter(Boolean);
  if (!missions.length) return null;
  return { day: String(raw.day || '').slice(0, 20), missions };
}

export function sanitize(raw) {
  const now = Date.now();
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return createInitialState(now);
  const base = createInitialState(now);
  const lines = {};
  for (const def of LINES) {
    const prev = raw.lines?.[def.id] || {};
    lines[def.id] = {
      unlocked: def.id === 'shoes' || Boolean(prev.unlocked),
      speed: clamp(Math.floor(num(prev.speed)), 0, 80),
      conveyor: clamp(Math.floor(num(prev.conveyor)), 0, 80),
      value: clamp(Math.floor(num(prev.value)), 0, 80),
      capacity: clamp(Math.floor(num(prev.capacity)), 0, 80),
      automation: clamp(Math.floor(num(prev.automation)), 0, 40),
      inventory: Math.max(0, Math.floor(num(prev.inventory))),
      progress: Math.max(0, num(prev.progress)),
      autoSell: Boolean(prev.autoSell),
      produced: Math.max(0, Math.floor(num(prev.produced))),
      sold: Math.max(0, Math.floor(num(prev.sold))),
      lastTap: Math.max(0, num(prev.lastTap)),
      raw: Math.max(0, Math.floor(num(prev.raw, prev.unlocked || def.id === 'shoes' ? 2 : 0))),
      wip: Math.max(0, Math.floor(num(prev.wip, prev.unlocked || def.id === 'shoes' ? 2 : 0))),
      intakeProgress: Math.max(0, num(prev.intakeProgress)),
      formProgress: Math.max(0, num(prev.formProgress)),
      condition: clamp(num(prev.condition, 100), 18, 100),
      wearNotified: Boolean(prev.wearNotified),
    };
  }

  const seen = new Set();
  const employees = [];
  if (Array.isArray(raw.employees)) {
    for (const employee of raw.employees) {
      const template = EMPLOYEE_MAP[employee?.templateId];
      if (!template || seen.has(template.id)) continue;
      seen.add(template.id);
      const assigned = LINE_MAP[employee.assignedLineId] ? employee.assignedLineId : null;
      employees.push({
        uid: String(employee.uid || `e-${template.id}`),
        templateId: template.id,
        level: clamp(Math.floor(num(employee.level, 1)), 1, 20),
        assignedLineId: assigned,
      });
    }
  }

  const owned = new Set(['dusk']);
  if (Array.isArray(raw.shop?.ownedThemes)) {
    for (const theme of raw.shop.ownedThemes) {
      if (theme === 'dusk' || THEME_SHOP.some((item) => item.id === theme)) owned.add(theme);
    }
  }
  const theme = owned.has(raw.shop?.theme) ? raw.shop.theme : 'dusk';
  const quality = ['high', 'medium', 'low'].includes(raw.settings?.quality) ? raw.settings.quality : 'high';
  const rooms = {};
  for (const room of ROOMS) {
    const prev = raw.rooms?.[room.id] || {};
    const lineOpen = room.lines.some((id) => lines[id]?.unlocked);
    rooms[room.id] = {
      owned: room.id === 'cutting' || Boolean(prev.owned) || lineOpen,
      slots: clamp(Math.floor(num(prev.slots)), 0, 4),
    };
  }
  const knownTech = new Set(RESEARCH.map((tech) => tech.id));
  const unlockedTech = Array.isArray(raw.research?.unlocked)
    ? raw.research.unlocked.filter((id) => knownTech.has(id))
    : [];
  const achievements = {};
  if (raw.achievements && typeof raw.achievements === 'object') {
    for (const [id, done] of Object.entries(raw.achievements)) {
      if (done) achievements[String(id).slice(0, 40)] = true;
    }
  }
  const contracts = Array.isArray(raw.contracts)
    ? raw.contracts.map((contract) => {
      if (!contract || !LINE_MAP[contract.lineId]) return null;
      const qty = Math.floor(num(contract.qty));
      if (qty <= 0) return null;
      return {
        id: String(contract.id || `con-${Math.random().toString(36).slice(2, 8)}`),
        lineId: contract.lineId,
        qty,
        loaded: clamp(Math.floor(num(contract.loaded)), 0, qty),
        reward: Math.max(0, num(contract.reward)),
        customer: String(contract.customer || 'Riverton Dispatch').slice(0, 40),
      };
    }).filter(Boolean).slice(0, 2)
    : [];

  return {
    ...base,
    money: Math.max(0, num(raw.money)),
    totalXp: Math.max(0, num(raw.totalXp)),
    totalEarned: Math.max(0, num(raw.totalEarned)),
    totalProduced: Math.max(0, Math.floor(num(raw.totalProduced))),
    totalSold: Math.max(0, Math.floor(num(raw.totalSold))),
    ordersCompleted: Math.max(0, Math.floor(num(raw.ordersCompleted))),
    ordersExpired: Math.max(0, Math.floor(num(raw.ordersExpired))),
    upgradesBought: Math.max(0, Math.floor(num(raw.upgradesBought))),
    playSeconds: Math.max(0, num(raw.playSeconds)),
    offlineSeconds: Math.max(0, num(raw.offlineSeconds)),
    lastTick: num(raw.lastTick, now),
    lines,
    upgrades: {
      warehouse: clamp(Math.floor(num(raw.upgrades?.warehouse)), 0, 40),
      training: clamp(Math.floor(num(raw.upgrades?.training)), 0, 40),
      reputation: clamp(Math.floor(num(raw.upgrades?.reputation)), 0, 40),
    },
    shop: {
      brand: clamp(Math.floor(num(raw.shop?.brand)), 0, 12),
      overclock: clamp(Math.floor(num(raw.shop?.overclock)), 0, 12),
      night: clamp(Math.floor(num(raw.shop?.night)), 0, 10),
      slots: clamp(Math.floor(num(raw.shop?.slots)), 0, 6),
      theme,
      ownedThemes: [...owned],
      surgeAt: Math.max(0, num(raw.shop?.surgeAt)),
      boostUntil: Math.max(0, num(raw.shop?.boostUntil)),
    },
    employees,
    orders: Array.isArray(raw.orders) ? raw.orders.map(sanitizeOrder).filter(Boolean).slice(0, 4) : base.orders,
    orderSeq: Math.max(2, Math.floor(num(raw.orderSeq, 2))),
    nextOrderFillAt: num(raw.nextOrderFillAt, now + 20000),
    pendingOffline: sanitizePending(raw.pendingOffline),
    tutorialStep: clamp(Math.floor(num(raw.tutorialStep)), 0, 3),
    materials: clamp(Math.floor(num(raw.materials, 40)), 0, 100000),
    materialTimer: Math.max(0, num(raw.materialTimer)),
    rooms,
    logistics: {
      forklifts: clamp(Math.floor(num(raw.logistics?.forklifts)), 0, 8),
      trucks: clamp(Math.floor(num(raw.logistics?.trucks)), 0, 6),
    },
    contracts,
    contractSeq: Math.max(1, Math.floor(num(raw.contractSeq, 1))),
    nextContractAt: num(raw.nextContractAt, now + 40000),
    contractsCompleted: Math.max(0, Math.floor(num(raw.contractsCompleted))),
    research: {
      points: Math.max(0, num(raw.research?.points)),
      unlocked: unlockedTech,
    },
    maintenanceCrew: clamp(Math.floor(num(raw.maintenanceCrew)), 0, 8),
    everRepaired: Boolean(raw.everRepaired),
    daily: sanitizeDaily(raw.daily),
    achievements,
    prestige: {
      points: Math.max(0, num(raw.prestige?.points)),
      runs: Math.max(0, Math.floor(num(raw.prestige?.runs))),
      speed: clamp(Math.floor(num(raw.prestige?.speed)), 0, 20),
      yield: clamp(Math.floor(num(raw.prestige?.yield)), 0, 20),
      care: clamp(Math.floor(num(raw.prestige?.care)), 0, 20),
    },
    totalSpent: Math.max(0, num(raw.totalSpent)),
    settings: {
      sound: raw.settings?.sound !== false,
      music: Boolean(raw.settings?.music),
      quality,
    },
  };
}

export function loadGame() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    return sanitize(JSON.parse(text));
  } catch (error) {
    console.warn('Could not read the Riverton save.', error);
    return null;
  }
}

export function saveGame(state) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Could not save Riverton.', error);
  }
}

export function clearGame() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.warn('Could not clear the Riverton save.', error);
  }
}
