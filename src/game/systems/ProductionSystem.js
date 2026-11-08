import { LINES } from '../../data/content.js';
import { canAutomate, getCapacity, getCycleTime, getSellPrice, isCrateBlocked } from '../../utils/economy.js';
import { chainBuffer, materialCap, reservedFor, truckDrop, truckInterval, wearPerItem } from '../../utils/growth.js';
import { noteProgress } from '../../utils/progressHooks.js';
import { grantXp } from '../../utils/progression.js';

export function simulate(state, dt, events) {
  deliverMaterials(state, dt);
  for (const def of LINES) {
    const line = state.lines[def.id];
    if (!line?.unlocked) continue;
    const cycle = getCycleTime(state, def.id);
    const capacity = getCapacity(state, def.id);
    const auto = Boolean(line.autoSell) && canAutomate(state, def.id);
    const buffer = chainBuffer(line);
    pullStage(line, 'intakeProgress', dt, cycle, () => (state.materials || 0) > 0 && (line.raw || 0) < buffer, () => {
      state.materials -= 1;
      line.raw = (line.raw || 0) + 1;
    });
    pullStage(line, 'formProgress', dt, cycle, () => (line.raw || 0) > 0 && (line.wip || 0) < buffer, () => {
      line.raw -= 1;
      line.wip = (line.wip || 0) + 1;
    });
    const reserved = auto ? reservedFor(state, def.id) : 0;
    if (isCrateBlocked(line.inventory, capacity, auto, reserved) && (line.wip || 0) > 0) {
      line.progress = cycle;
    } else {
      line.progress += dt;
    }
    const price = getSellPrice(state, def.id);
    let count = 0;
    let money = 0;
    while (line.progress >= cycle && count < 1000) {
      if (isCrateBlocked(line.inventory, capacity, auto, reserved)) {
        line.progress = cycle;
        break;
      }
      if ((line.wip || 0) <= 0) {
        line.progress = Math.min(line.progress, cycle);
        break;
      }
      line.progress -= cycle;
      line.wip -= 1;
      count += 1;
      line.produced += 1;
      state.totalProduced += 1;
      line.condition = Math.max(18, (line.condition ?? 100) - wearPerItem(state));
      if (auto && line.inventory >= reserved) {
        money += price;
        line.sold += 1;
        state.totalSold += 1;
      } else {
        line.inventory += 1;
      }
    }
    if ((line.condition ?? 100) < 40 && !line.wearNotified) {
      line.wearNotified = true;
      events.push({ type: 'maintenance', lineId: def.id, message: `${def.short} is wearing down. Schedule a repair.` });
    }
    if (count <= 0) continue;
    if (money > 0) {
      state.money += money;
      state.totalEarned += money;
      noteProgress(state, 'earn', money);
    }
    noteProgress(state, 'produce', count);
    grantXp(state, count * def.tier, events);
    state.research.points += count / 4;
    if (state.tutorialStep < 1) state.tutorialStep = 1;
    events.push({
      type: 'produce',
      lineId: def.id,
      count,
      money,
      auto,
    });
  }
}

function pullStage(line, key, dt, cycle, ready, apply) {
  line[key] = (line[key] || 0) + dt;
  let steps = 0;
  while (line[key] >= cycle && steps < 1000) {
    if (!ready()) {
      line[key] = cycle;
      break;
    }
    line[key] -= cycle;
    apply();
    steps += 1;
  }
}

function deliverMaterials(state, dt) {
  state.materialTimer = (state.materialTimer || 0) + dt;
  const interval = truckInterval(state);
  const drop = truckDrop(state);
  const cap = materialCap(state);
  let trips = 0;
  while (state.materialTimer >= interval && trips < 40) {
    state.materialTimer -= interval;
    state.materials = Math.min(cap, (state.materials || 0) + drop);
    trips += 1;
  }
}
