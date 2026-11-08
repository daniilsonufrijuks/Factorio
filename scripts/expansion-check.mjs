import { createInitialState } from '../src/game/state.js';
import { sanitize } from '../src/utils/storage.js';
import {
  doBuyRoom,
  doClaimMission,
  doForklifts,
  doLoadContract,
  doPrestige,
  doRepair,
  doResearch,
  doSellAll,
  doUnlockLine,
  tick,
} from '../src/game/engine.js';
import { getLineStats } from '../src/utils/economy.js';

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

let state = createInitialState(Date.now());
state = run(20, state);
if (state.totalProduced < 4) throw new Error(`Pipeline did not produce, got ${state.totalProduced}`);
if ((state.materials ?? 0) >= 40 && state.totalProduced > 0) {
  // trucks may refill, but raw/wip should exist on the line
}
const stats = getLineStats(state, 'shoes');
if (!stats.bottleneck) throw new Error('Missing bottleneck');
if (state.lines.shoes.raw == null || state.lines.shoes.wip == null) throw new Error('Chain buffers missing');

state.materials = 0;
state.lines.shoes.raw = 0;
state.lines.shoes.wip = 0;
state.materialTimer = 0;
state.logistics.forklifts = 0;
state.logistics.trucks = 0;
const dry = getLineStats(state, 'shoes');
if (dry.bottleneck !== 'Need raw' && dry.bottleneck !== 'Intake slow') {
  throw new Error(`Expected a supply bottleneck, got ${dry.bottleneck}`);
}

state.totalXp = 2000;
state.lines.shirts.unlocked = true;
const blocked = doUnlockLine(state, 'watches');
if (!deny(blocked)) throw new Error('Watches opened without the assembly room');
if (!blocked.events.some((event) => /assembly/i.test(event.message || ''))) {
  throw new Error(`Expected the assembly gate, got ${blocked.events.map((event) => event.message).join(' ')}`);
}

state.money = 5000;
state.totalXp = 5000;
const room = doBuyRoom(state, 'assembly');
if (deny(room)) throw new Error(room.events.map((event) => event.message).join(' '));
state = room.state;
if (!state.rooms.assembly.owned) throw new Error('Assembly room did not unlock');

state.lines.shoes.condition = 40;
const repair = doRepair(state, 'shoes');
if (deny(repair)) throw new Error(repair.events.map((event) => event.message).join(' '));
state = repair.state;
if (state.lines.shoes.condition < 99 || !state.everRepaired) throw new Error('Repair failed');

state.research.points = 30;
const tech = doResearch(state, 'sharper-dies');
if (deny(tech)) throw new Error('Research failed');
state = tech.state;
if (!state.research.unlocked.includes('sharper-dies')) throw new Error('Tech was not saved');
const faster = getLineStats(state, 'shoes').cycle;
state.research.unlocked = state.research.unlocked.filter((id) => id !== 'sharper-dies');
const slower = getLineStats(state, 'shoes').cycle;
if (!(faster < slower)) throw new Error('Research did not speed the line');
state.research.unlocked.push('sharper-dies');

state = run(5, state);
const mission = state.daily?.missions?.find((entry) => entry.kind === 'produce');
if (!mission || mission.progress <= 0) throw new Error('Daily production mission did not move');
mission.progress = mission.goal;
const claimed = doClaimMission(state, mission.id);
if (deny(claimed)) throw new Error('Mission claim failed');
state = claimed.state;
if (!state.daily.missions.find((entry) => entry.id === mission.id).claimed) throw new Error('Mission was not marked claimed');

state.lines.shoes.inventory = 8;
state.nextContractAt = 0;
state.contracts = [];
state = tick(state, state.lastTick + 500).state;
const contract = state.contracts[0];
if (!contract) throw new Error('No delivery contract was offered');
state.lines[contract.lineId].inventory = contract.qty;
let loaded = doLoadContract(state, contract.id);
if (deny(loaded)) throw new Error(loaded.events.map((event) => event.message).join(' '));
state = loaded.state;
if ((state.contractsCompleted || 0) < 1) throw new Error('Contract did not complete');

const beforePrestige = state.research.unlocked.slice();
state.totalEarned = 30000;
const prestige = doPrestige(state);
if (deny(prestige)) throw new Error(prestige.events.map((event) => event.message).join(' '));
state = prestige.state;
if (state.money > 5000) throw new Error('Prestige did not reset the run cash');
if (!state.rooms.cutting.owned || state.rooms.assembly.owned) throw new Error('Rooms did not reset');
if (!state.research.unlocked.includes('sharper-dies')) throw new Error('Research was wiped');
if (!state.achievements['prestige-once']) throw new Error('Prestige achievement missing');
if (state.prestige.runs < 1) throw new Error('Prestige run was not counted');

const forks = doForklifts({ ...state, money: 10000 });
if (deny(forks)) throw new Error('Forklift upgrade failed');

state = run(12, createInitialState(Date.now()));
state.orders = [];
state = doSellAll(state).state;
if (state.money <= 0) throw new Error('Sell still works');

const migrated = sanitize({ version: 1, money: 12, lines: { shoes: { unlocked: true, inventory: 3 }, watches: { unlocked: true } } });
if (!migrated.rooms.assembly.owned) throw new Error('Old save did not inherit the assembly room');
if (migrated.lines.shoes.inventory !== 3) throw new Error('Old inventory was lost');
if (migrated.research.points !== 0) throw new Error('Research points invented on an old save');

console.log('Expansion check passed');
console.log(`Produced sample ${state.totalProduced}, research kept ${beforePrestige.join(',')}`);
