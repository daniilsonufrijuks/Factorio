import { simulate } from './systems/ProductionSystem.js';
import {
  accrueOffline,
  buyStack,
  buyTheme,
  buyWhistle,
  claimSurge,
  collectOffline,
  dismissTutorial,
  equipTheme,
  patchSettings,
  sellAll,
  sellLine,
  setAutoSell,
  tapLine,
} from './systems/EconomySystem.js';
import { buyGlobalUpgrade, buyLineUpgrade, unlockLine } from './systems/UpgradeSystem.js';
import { assignEmployee, hireEmployee, trainEmployee } from './systems/EmployeeSystem.js';
import { completeOrder, maintain } from './systems/OrderSystem.js';
import {
  buyCrew,
  buyForklifts,
  buyPallet,
  buyPrestigeUpgrade,
  buyResearch,
  buyRoom,
  buySlot,
  buyTrucks,
  claimMission,
  housekeeping,
  loadContract,
  prestigeRun,
  repairLine,
} from './systems/GrowthSystem.js';

const OFFLINE_MIN_SECONDS = 20;

function act(state, mutator) {
  try {
    const next = structuredClone(state);
    const events = [];
    const result = mutator(next, events) || { ok: true };
    if (result.ok === false) {
      return { state, events: [{ type: 'deny', message: result.reason || 'Cannot do that.' }] };
    }
    if (next.money < -0.01) {
      return { state, events: [{ type: 'deny', message: 'Not enough cash.' }] };
    }
    next.money = Math.max(0, next.money);
    housekeeping(next, events, Date.now());
    return { state: next, events };
  } catch (error) {
    console.error(error);
    return { state, events: [{ type: 'deny', message: 'Something glitched. Try again.' }] };
  }
}

export function tick(state, now = Date.now()) {
  try {
    const next = structuredClone(state);
    const events = [];
    const gap = (now - (next.lastTick || now)) / 1000;
    if (!Number.isFinite(gap) || gap < 0) {
      next.lastTick = now;
      return { state: next, events };
    }
    if (gap > OFFLINE_MIN_SECONDS) {
      accrueOffline(next, gap, now, events);
      return { state: next, events };
    }
    next.lastTick = now;
    next.playSeconds += gap;
    housekeeping(next, events, now);
    simulate(next, gap, events);
    maintain(next, now, events);
    housekeeping(next, events, now);
    if (!Number.isFinite(next.money) || next.money < 0) next.money = 0;
    return { state: next, events };
  } catch (error) {
    console.error('Tick failed', error);
    return { state, events: [] };
  }
}

export function doSellLine(state, lineId) {
  return act(state, (draft, events) => sellLine(draft, events, lineId));
}

export function doSellAll(state) {
  return act(state, (draft, events) => sellAll(draft, events));
}

export function doSetAutoSell(state, lineId, enabled) {
  return act(state, (draft, events) => setAutoSell(draft, events, lineId, enabled));
}

export function doTap(state, lineId, now = Date.now()) {
  return act(state, (draft, events) => {
    const result = tapLine(draft, events, lineId, now);
    if (result.ok) simulate(draft, 0, events);
    return result;
  });
}

export function doBuyLineUpgrade(state, lineId, key) {
  return act(state, (draft, events) => buyLineUpgrade(draft, events, lineId, key));
}

export function doBuyGlobalUpgrade(state, id) {
  return act(state, (draft, events) => buyGlobalUpgrade(draft, events, id));
}

export function doUnlockLine(state, lineId) {
  return act(state, (draft, events) => unlockLine(draft, events, lineId));
}

export function doHire(state, templateId) {
  return act(state, (draft, events) => hireEmployee(draft, events, templateId));
}

export function doTrain(state, templateId) {
  return act(state, (draft, events) => trainEmployee(draft, events, templateId));
}

export function doAssign(state, templateId, lineId) {
  return act(state, (draft, events) => assignEmployee(draft, events, templateId, lineId));
}

export function doCompleteOrder(state, orderId) {
  return act(state, (draft, events) => completeOrder(draft, events, orderId));
}

export function doBuyStack(state, itemId) {
  return act(state, (draft, events) => buyStack(draft, events, itemId));
}

export function doBuyTheme(state, themeId) {
  return act(state, (draft, events) => buyTheme(draft, events, themeId));
}

export function doEquipTheme(state, themeId) {
  return act(state, (draft, events) => equipTheme(draft, events, themeId));
}

export function doWhistle(state, now = Date.now()) {
  return act(state, (draft, events) => buyWhistle(draft, events, now));
}

export function doSurge(state, now = Date.now()) {
  return act(state, (draft, events) => claimSurge(draft, events, now));
}

export function doCollectOffline(state) {
  return act(state, (draft, events) => collectOffline(draft, events));
}

export function doDismissTutorial(state) {
  return act(state, (draft, events) => dismissTutorial(draft, events));
}

export function doSettings(state, partial) {
  return act(state, (draft, events) => patchSettings(draft, events, partial));
}

export function doBuyRoom(state, roomId) {
  return act(state, (draft, events) => buyRoom(draft, events, roomId));
}

export function doBuySlot(state, roomId) {
  return act(state, (draft, events) => buySlot(draft, events, roomId));
}

export function doResearch(state, techId) {
  return act(state, (draft, events) => buyResearch(draft, events, techId));
}

export function doForklifts(state) {
  return act(state, (draft, events) => buyForklifts(draft, events));
}

export function doTrucks(state) {
  return act(state, (draft, events) => buyTrucks(draft, events));
}

export function doCrew(state) {
  return act(state, (draft, events) => buyCrew(draft, events));
}

export function doPallet(state) {
  return act(state, (draft, events) => buyPallet(draft, events));
}

export function doRepair(state, lineId) {
  return act(state, (draft, events) => repairLine(draft, events, lineId));
}

export function doLoadContract(state, contractId) {
  return act(state, (draft, events) => loadContract(draft, events, contractId));
}

export function doClaimMission(state, missionId) {
  return act(state, (draft, events) => claimMission(draft, events, missionId));
}

export function doPrestigeUpgrade(state, key) {
  return act(state, (draft, events) => buyPrestigeUpgrade(draft, events, key));
}

export function doPrestige(state) {
  return act(state, (draft, events) => prestigeRun(draft, events));
}
