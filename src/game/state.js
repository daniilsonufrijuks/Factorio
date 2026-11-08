import { LINES } from '../data/content.js';

export function blankLine(def, unlocked) {
  return {
    unlocked,
    speed: 0,
    conveyor: 0,
    value: 0,
    capacity: 0,
    automation: 0,
    inventory: 0,
    progress: 0,
    autoSell: false,
    produced: 0,
    sold: 0,
    lastTap: 0,
    raw: unlocked ? 2 : 0,
    wip: unlocked ? 2 : 0,
    intakeProgress: 0,
    formProgress: 0,
    condition: 100,
    wearNotified: false,
  };
}

export function makeStarterOrder(now) {
  return {
    id: 'ord-starter',
    type: 'standard',
    lineId: 'shoes',
    qty: 5,
    reward: 132,
    xp: 18,
    deadline: null,
    createdAt: now,
    title: 'Corner store starter',
    customer: 'Pell Market',
    difficulty: 'Easy',
  };
}

export function createInitialState(now = Date.now()) {
  const lines = {};
  for (const def of LINES) {
    lines[def.id] = blankLine(def, def.id === 'shoes');
  }
  return {
    version: 1,
    money: 0,
    totalXp: 0,
    totalEarned: 0,
    totalProduced: 0,
    totalSold: 0,
    ordersCompleted: 0,
    ordersExpired: 0,
    upgradesBought: 0,
    playSeconds: 0,
    offlineSeconds: 0,
    lastTick: now,
    lines,
    upgrades: {
      warehouse: 0,
      training: 0,
      reputation: 0,
    },
    shop: {
      brand: 0,
      overclock: 0,
      night: 0,
      slots: 0,
      theme: 'dusk',
      ownedThemes: ['dusk'],
      surgeAt: 0,
      boostUntil: 0,
    },
    employees: [],
    orders: [makeStarterOrder(now)],
    orderSeq: 2,
    nextOrderFillAt: now + 25000,
    pendingOffline: null,
    tutorialStep: 0,
    materials: 40,
    materialTimer: 0,
    rooms: {
      cutting: { owned: true, slots: 0 },
      assembly: { owned: false, slots: 0 },
      packaging: { owned: false, slots: 0 },
      shipping: { owned: false, slots: 0 },
    },
    logistics: { forklifts: 0, trucks: 0 },
    contracts: [],
    contractSeq: 1,
    nextContractAt: now + 40000,
    contractsCompleted: 0,
    research: { points: 0, unlocked: [] },
    maintenanceCrew: 0,
    everRepaired: false,
    daily: null,
    achievements: {},
    prestige: { points: 0, runs: 0, speed: 0, yield: 0, care: 0 },
    totalSpent: 0,
    settings: {
      sound: true,
      music: false,
      quality: 'high',
    },
  };
}
