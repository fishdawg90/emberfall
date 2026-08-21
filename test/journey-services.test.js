import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshState, normalizeSave } from '../game-state.js';
import {
  canChallengeMineGate,
  getGreyfenTasks,
  getJourneyObjective,
  recordServiceVisit,
  recordTownArrival,
  recordTradeCoins
} from '../journey-services.js';

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

test('journey connects inn restoration to regional patrol and guardian progress', () => {
  const state = createFreshState();
  state.journey.services = { mine: true, smelter: true, forge: true, market: true };
  state.journey.tradeCoins = 15;
  state.gear.push({ id: 1, type: 'weapon', recipe: 'is', name: 'Iron Longsword', atk: 4, def: 0, val: 30 });
  state.eq.weapon = 1;
  state.journey.towns.frostmere = true;
  state.town.inn = 1;

  assert.equal(getJourneyObjective(state).id, 'patrol-cave');
  state.explore.area = 'cave';
  assert.equal(getJourneyObjective(state).worldAction, 'patrol');
  state.explore.regionWins.cave = 3;
  assert.equal(getJourneyObjective(state).id, 'guardian-cave');
  state.explore.claimed.cave = true;
  assert.equal(getJourneyObjective(state).id, 'patrol-forest');
});
