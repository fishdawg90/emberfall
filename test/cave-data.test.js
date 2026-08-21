import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshState, normalizeSave } from '../game-state.js';
import {
  CAVE_HEIGHT,
  CAVE_WIDTH,
  caveCellToWorld,
  caveWorldToCell,
  createCaveLayout,
  getCavePath
} from '../cave-data.js';
import {
  enterLowerWays,
  getCaveRunView,
  markCaveBossStarted,
  updateCavePosition,
  useNearbyCaveCoinCache,
  useNearbyCaveHealing
} from '../cave-services.js';

test('Lower Ways generation is deterministic, connected, braided, and ends far from its entrance', () => {
  const first = createCaveLayout(48731);
  const second = createCaveLayout(48731);
  assert.deepEqual(first.passages, second.passages);
  assert.equal(first.cells.length, CAVE_WIDTH * CAVE_HEIGHT);
  assert.equal(getCavePath(first, first.start, first.goal).length, first.longestPath + 1);
  assert.equal(first.longestPath >= 24, true);
  assert.equal(first.loops >= 2, true);
  for (const cell of first.cells) assert.equal(getCavePath(first, first.start, cell.index).length > 0, true);
});

test('cell and world coordinates round-trip for cave navigation', () => {
  const layout = createCaveLayout(991);
  for (const index of [layout.start, layout.goal, 17, 72]) {
    const world = caveCellToWorld(layout, index);
    assert.equal(caveWorldToCell(layout, world).index, index);
  }
});

test('a cave run persists its seed, discoveries, and exact position through save normalization', () => {
  const state = createFreshState();
  const entered = enterLowerWays(state, [203, 158]);
  const target = caveCellToWorld(entered.layout, getCavePath(entered.layout, entered.layout.start, entered.layout.goal)[3]);
  updateCavePosition(state, target);
  const normalized = normalizeSave(state);
  assert.equal(normalized.explore.caveRun.active, true);
  assert.equal(normalized.explore.caveRun.seed, entered.run.seed);
  assert.deepEqual(normalized.explore.caveRun.position, [target.x, target.z]);
  assert.equal(normalized.explore.caveRun.discovered.includes(normalized.explore.caveRun.cell), true);
});

test('healing growths are deterministic, one-use, and do not disappear while health is full', () => {
  let state;
  let view;
  for (let seed = 1; seed < 1000; seed += 1) {
    state = createFreshState();
    state.explore.worldSeed = seed;
    view = getCaveRunView(state);
    if (view.layout.furnishings.heals.length) break;
  }
  assert.equal(view.layout.furnishings.heals.length > 0, true);
  const healCell = view.layout.furnishings.heals[0];
  const position = caveCellToWorld(view.layout, healCell);
  enterLowerWays(state, [203, 158]);
  updateCavePosition(state, position);
  state.explore.hp = state.explore.maxHp;
  assert.equal(useNearbyCaveHealing(state, position).available, true);
  assert.equal(state.explore.caveRun.claimedHeals.length, 0);
  state.explore.hp = 1;
  const healed = useNearbyCaveHealing(state, position);
  assert.equal(healed.healed, true);
  assert.equal(healed.amount >= 9, true);
  assert.equal(useNearbyCaveHealing(state, position).healed, false);
});

test('every Lower Ways run contains healing and one-use coin discoveries', () => {
  const state = createFreshState();
  const view = getCaveRunView(state);
  assert.equal(view.layout.furnishings.heals.length >= 1, true);
  assert.equal(view.layout.furnishings.coins.length >= 3, true);
  const cache = view.layout.furnishings.coins[0];
  const position = caveCellToWorld(view.layout, cache);
  enterLowerWays(state, [203, 158]);
  const before = state.coins;
  const found = useNearbyCaveCoinCache(state, position);
  assert.equal(found.claimed, true);
  assert.equal(state.coins, before + found.coins);
  assert.equal(useNearbyCaveCoinCache(state, position).claimed, false);
  const normalized = normalizeSave(state);
  assert.equal(normalized.explore.caveRun.claimedCoins.includes(cache), true);
});

test('the cave guardian can only begin at the maze goal', () => {
  const state = createFreshState();
  const entered = enterLowerWays(state, [203, 158]);
  assert.equal(markCaveBossStarted(state).code, 'boss-distant');
  updateCavePosition(state, caveCellToWorld(entered.layout, entered.layout.goal));
  assert.equal(markCaveBossStarted(state).ok, true);
  assert.equal(markCaveBossStarted(state).code, 'boss-started');
});
