import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshState, normalizeSave } from '../game-state.js';
import {
  canChallengeMineGate,
  getActiveMission,
  getGreyfenTasks,
  getInterfaceUnlocks,
  getMetalUnlockState,
  getJourneyObjective,
  getMissionJournal,
  pinMission,
  recordServiceVisit,
  recordTownArrival,
  recordTradeCoins
} from '../journey-services.js';

test('interface systems reveal through town discovery and useful inventory', () => {
  const state = createFreshState();
  assert.deepEqual(
    Object.fromEntries(Object.entries(getInterfaceUnlocks(state)).filter(([, value]) => value === true)),
    { work: true, town: true, journal: true }
  );
  assert.equal(getInterfaceUnlocks(state).projects.inn, false);

  recordServiceVisit(state, 'mine');
  assert.equal(getInterfaceUnlocks(state).mining, true);
  assert.equal(getInterfaceUnlocks(state).smelting, false);
  recordServiceVisit(state, 'smelter');
  assert.equal(getInterfaceUnlocks(state).smelting, true);
  assert.equal(getInterfaceUnlocks(state).projects.smelter, true);
  recordServiceVisit(state, 'forge');
  assert.equal(getInterfaceUnlocks(state).forge, true);
  assert.equal(getInterfaceUnlocks(state).training, true);
  assert.equal(getInterfaceUnlocks(state).gear, false);

  state.gear.push({ id: 1, type: 'weapon', name: 'Iron Longsword' });
  assert.equal(getInterfaceUnlocks(state).gear, true);
  state.journey.towns.frostmere = true;
  assert.equal(getInterfaceUnlocks(state).projects.inn, true);
});

test('metal unlock states explain future mines before they become selectable', () => {
  const state = createFreshState();
  const ironBefore = getMetalUnlockState(state, 0);
  assert.equal(ironBefore.opened, false);
  assert.equal(ironBefore.miningStatus, 'Find Greyfen’s town mine');

  recordServiceVisit(state, 'mine');
  assert.equal(getMetalUnlockState(state, 0).miningReady, true);
  assert.equal(getMetalUnlockState(state, 1).miningStatus, 'Secure the Lower Ways');

  state.open = 1;
  assert.equal(getMetalUnlockState(state, 1).miningStatus, 'Mining Lv 1/5');
  state.skills.mining.l = 5;
  assert.equal(getMetalUnlockState(state, 1).miningStatus, 'Mine open');
  assert.equal(getMetalUnlockState(state, 1).smeltingStatus, 'Find Greyfen’s smelter');
});

test('journey guides a fresh hero through ore, bars, forging, and equipment', () => {
  const state = createFreshState();
  assert.equal(getJourneyObjective(state).id, 'find-mine');
  recordServiceVisit(state, 'mine');
  assert.equal(getJourneyObjective(state).id, 'first-ore');

  state.inv.ironOre = 9;
  assert.equal(getJourneyObjective(state).id, 'find-smelter');
  recordServiceVisit(state, 'smelter');
  assert.equal(getJourneyObjective(state).id, 'first-bars');

  state.inv.ironBar = 3;
  assert.equal(getJourneyObjective(state).id, 'find-forge');
  recordServiceVisit(state, 'forge');
  assert.equal(getJourneyObjective(state).id, 'first-forge');

  state.gear.push({ id: 1, type: 'weapon', recipe: 'is', name: 'Iron Longsword', atk: 4, def: 0, val: 30 });
  assert.equal(getJourneyObjective(state).id, 'find-market');
  recordServiceVisit(state, 'market');
  assert.equal(getJourneyObjective(state).id, 'first-trade');
  recordTradeCoins(state, 15);
  assert.equal(getJourneyObjective(state).id, 'first-equip');
  state.eq.weapon = 1;
  assert.equal(getJourneyObjective(state).id, 'visit-frostmere');
});

test('equipping early cannot skip Greyfen discovery and market tasks', () => {
  const state = createFreshState();
  recordServiceVisit(state, 'mine');
  state.gear.push({ id: 1, type: 'weapon', recipe: 'is', name: 'Iron Longsword', atk: 4, def: 0, val: 30 });
  state.eq.weapon = 1;
  assert.equal(getJourneyObjective(state).id, 'find-market');
  recordServiceVisit(state, 'market');
  assert.equal(getJourneyObjective(state).id, 'first-trade');
});

test('mission journal exposes campaign progress and persists an unlocked active mission', () => {
  const state = createFreshState();
  const fresh = getMissionJournal(state);
  assert.equal(fresh.find(mission => mission.id === 'greyfen-apprenticeship').unlocked, true);
  assert.equal(fresh.find(mission => mission.id === 'northern-survey').unlocked, false);
  assert.equal(getActiveMission(state).id, 'greyfen-apprenticeship');
  assert.equal(pinMission(state, 'restore-greyfen').code, 'mission-locked');

  for (const service of ['mine', 'smelter', 'forge', 'market']) recordServiceVisit(state, service);
  recordTradeCoins(state, 15);
  state.gear.push({ id: 1, type: 'weapon', name: 'Iron Longsword' });
  state.eq.weapon = 1;
  assert.equal(pinMission(state, 'restore-greyfen').ok, true);
  assert.equal(getActiveMission(state).id, 'restore-greyfen');
  assert.equal(normalizeSave(state).journey.activeMission, 'restore-greyfen');
});

test('Greyfen task board and regional mine gates persist world-led progress', () => {
  const state = createFreshState();
  for (const service of ['mine', 'smelter', 'forge', 'market']) recordServiceVisit(state, service);
  recordTradeCoins(state, 7);
  assert.equal(getGreyfenTasks(state).filter(task => task.complete).length, 4);
  assert.equal(getGreyfenTasks(state).find(task => task.id === 'trade').progress, '7/15');
  recordTradeCoins(state, 8);
  assert.equal(getGreyfenTasks(state).every(task => task.complete), true);

  state.journey.towns.sunspire = true;
  state.explore.area = 'town';
  state.explore.townId = 'sunspire';
  assert.equal(canChallengeMineGate(state, 2), true);
  state.explore.townId = 'frostmere';
  assert.equal(canChallengeMineGate(state, 2), false);
  assert.equal(normalizeSave(state).journey.tradeCoins, 15);
});

test('town welcome contracts are one-time rewards that survive normalized saves', () => {
  const state = createFreshState();
  state.journey.services = { mine: true, smelter: true, forge: true, market: true };
  state.journey.tradeCoins = 15;
  const first = recordTownArrival(state, 'frostmere');
  const second = recordTownArrival(state, 'frostmere');

  assert.equal(first.discovered, true);
  assert.equal(first.coins, 30);
  assert.equal(state.coins, 85);
  assert.equal(second.discovered, false);
  assert.equal(normalizeSave(state).journey.towns.frostmere, true);
});

test('journey connects inn restoration to the explorable Lower Ways maze', () => {
  const state = createFreshState();
  state.journey.services = { mine: true, smelter: true, forge: true, market: true };
  state.journey.tradeCoins = 15;
  state.gear.push({ id: 1, type: 'weapon', recipe: 'is', name: 'Iron Longsword', atk: 4, def: 0, val: 30 });
  state.eq.weapon = 1;
  state.journey.towns.frostmere = true;
  state.town.inn = 1;

  assert.equal(getJourneyObjective(state).id, 'prepare-lower-ways');
  state.gear.push({ id: 2, type: 'chest', recipe: 'ia', name: 'Iron Brigandine', atk: 0, def: 6, val: 60 });
  state.eq.chest = 2;
  assert.equal(getJourneyObjective(state).id, 'enter-lower-ways');
  state.explore.caveRun.active = true;
  state.explore.area = 'cave';
  state.explore.caveRun.discovered = [0, 1, 2, 3];
  assert.equal(getJourneyObjective(state).id, 'explore-lower-ways');
  assert.equal(getJourneyObjective(state).worldAction, 'cave-goal');
  assert.match(getJourneyObjective(state).detail, /4\/99 chambers/);
  state.explore.claimed.cave = true;
  assert.equal(getJourneyObjective(state).id, 'patrol-forest');
});
