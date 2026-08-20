import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshState, normalizeSave } from '../game-state.js';
import { getJourneyObjective, recordTownArrival } from '../journey-services.js';

test('journey guides a fresh hero through ore, bars, forging, and equipment', () => {
  const state = createFreshState();
  assert.equal(getJourneyObjective(state).id, 'first-ore');

  state.inv.ironOre = 9;
  assert.equal(getJourneyObjective(state).id, 'first-bars');

  state.inv.ironBar = 3;
  assert.equal(getJourneyObjective(state).id, 'first-forge');

  state.gear.push({ id: 1, type: 'weapon', recipe: 'is', name: 'Iron Longsword', atk: 4, def: 0, val: 30 });
  assert.equal(getJourneyObjective(state).id, 'first-equip');
  state.eq.weapon = 1;
  assert.equal(getJourneyObjective(state).id, 'visit-frostmere');
});

test('town welcome contracts are one-time rewards that survive normalized saves', () => {
  const state = createFreshState();
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
