import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshState } from '../game-state.js';
import {
  WORLD_LANDMARKS,
  WORLD_ROUTES,
  WORLD_SPACE_VERSION,
  getAreaAtPosition,
  getFastTravelLandmarks,
  isGuardianAvailable,
  readHostedWorldPosition,
  writeHostedWorldPosition
} from '../world-data.js';

test('hosted overworld preserves all original named landmarks and connected routes', () => {
  assert.deepEqual(WORLD_LANDMARKS.map(landmark => landmark.name), [
    'Greyfen',
    'Frostmere',
    'Sunspire',
    'Tidewatch',
    'Whisperwood',
    'The Lower Ways'
  ]);
  assert.equal(WORLD_ROUTES.length, 11);
  assert.equal(WORLD_ROUTES.every(route => route.points.length >= 3), true);
  assert.equal(WORLD_ROUTES.filter(route => /street|crossing/.test(route.id)).length, 6);
});

test('legacy map coordinates fall back safely while hosted positions round-trip', () => {
  const state = createFreshState();
  assert.deepEqual(readHostedWorldPosition(state.explore), { x: 0, z: 126, migrated: true });

  const area = getAreaAtPosition({ x: -212, z: -198 });
  writeHostedWorldPosition(state.explore, { x: -212.345, z: -198.765 }, area);
  assert.equal(state.explore.worldSpace, WORLD_SPACE_VERSION);
  assert.deepEqual(state.explore.worldPos, [-212.34, -198.76]);
  assert.deepEqual(readHostedWorldPosition(state.explore), { x: -212.34, z: -198.76, migrated: false });
  assert.equal(state.explore.area, 'town');
  assert.equal(state.explore.townId, 'frostmere');
  writeHostedWorldPosition(state.explore, { x: 0, z: 260 });
  assert.equal(state.explore.area, 'world');
  assert.equal('townId' in state.explore, false);
});

test('continuous world areas are safe in towns and region-specific near guardians', () => {
  assert.equal(getAreaAtPosition({ x: 0, z: 128 }).area, 'town');
  assert.equal(getAreaAtPosition({ x: -225, z: 165 }).area, 'forest');
  assert.equal(getAreaAtPosition({ x: 225, z: 170 }).area, 'cave');
  assert.equal(getAreaAtPosition({ x: 0, z: 260 }).area, 'world');
});

test('guardian and fast-travel gates follow original three-win region claims', () => {
  const state = createFreshState();
  assert.deepEqual(getFastTravelLandmarks(state).map(landmark => landmark.id), ['town']);
  assert.equal(isGuardianAvailable(state, 'forest'), false);
  state.explore.regionWins.forest = 3;
  assert.equal(isGuardianAvailable(state, 'forest'), true);
  state.explore.claimed.forest = true;
  assert.equal(isGuardianAvailable(state, 'forest'), false);
  assert.deepEqual(getFastTravelLandmarks(state).map(landmark => landmark.id), ['town', 'forest']);
});
