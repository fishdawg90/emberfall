import test from 'node:test';
import assert from 'node:assert/strict';

import { METALS, RECIPES } from '../game-catalog.js';
import { COMPATIBLE_SAVE_KEYS, createFreshState, loadGameState, normalizeSave, resetGameState, saveGameState } from '../game-state.js';
import {
  equipItem,
  forgeItem,
  getCycleSeconds,
  getEquipment,
  getMarketMultiplier,
  getTownCost,
  restoreTown,
  runWorkCycle,
  selectMineDepth,
  selectSmeltMetal,
  sellGear,
  sellMaterial,
  simulateOfflineWork,
  skillXpNeeded
} from '../gameplay-services.js';

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

test('reset clears every save alias and writes a clean compatible state', () => {
  const storage = memoryStorage(Object.fromEntries(COMPATIBLE_SAVE_KEYS.map(key => [key, JSON.stringify({ ...createFreshState(), coins: 999, last: 999 })])));
  const reset = resetGameState(storage);
  assert.deepEqual(reset.removed, [...COMPATIBLE_SAVE_KEYS]);
  assert.equal(reset.errors.length, 0);
  assert.equal(loadGameState(storage).state.coins, 55);
  assert.equal(storage.values.has('emberfall_depths_v20_6'), false);
});

test('catalog keeps the original four tiers and 24 forge recipes', () => {
  assert.deepEqual(METALS.map(metal => metal.id), ['iron', 'deepsteel', 'starsilver', 'aetherite']);
  assert.equal(RECIPES.length, 24);
  assert.deepEqual(new Set(RECIPES.map(recipe => recipe.type)), new Set(['weapon', 'hands', 'head', 'feet', 'legs', 'chest']));
});

test('v4 and v20.x aliases choose the newest save without losing unknown fields', () => {
  const older = { ...createFreshState(), coins: 99, last: 10 };
  const newer = { ...createFreshState(), coins: 321, last: 20, futureSystem: { intact: true }, eq: { armor: 17 } };
  const storage = memoryStorage({
    emberfall_depths_v4: JSON.stringify(older),
    emberfall_depths_v20_5: JSON.stringify(newer)
  });
  const loaded = loadGameState(storage);

  assert.equal(loaded.sourceKey, 'emberfall_depths_v20_5');
  assert.equal(loaded.state.coins, 321);
  assert.equal(loaded.state.eq.chest, 17);
  assert.deepEqual(loaded.state.futureSystem, { intact: true });

  const saved = saveGameState(loaded.state, storage);
  assert.deepEqual(saved.written, ['emberfall_depths_v4', 'emberfall_depths_v20_5']);
  assert.deepEqual(JSON.parse(storage.values.get('emberfall_depths_v4')).futureSystem, { intact: true });
});

test('normalization migrates armor gear while retaining combat and exploration data', () => {
  const normalized = normalizeSave({
    gear: [{ id: 4, type: 'armor', name: 'Old Mail' }],
    eq: { armor: 4 },
    forgeAnim: { r: 'is', consumed: 2 },
    explore: { area: 'forest', combat: { enemyId: 'crawler', energy: 2, resolving: true }, regionWins: { forest: 2 } }
  });
  assert.equal(normalized.gear[0].type, 'chest');
  assert.equal(normalized.eq.chest, 4);
  assert.equal(normalized.explore.area, 'forest');
  assert.equal(normalized.explore.combat.enemyId, 'crawler');
  assert.equal(normalized.explore.combat.resolving, false);
  assert.equal(normalized.explore.regionWins.forest, 2);
  assert.equal(normalized.forgeAnim, null);
});

test('mining cycle preserves original critical yield and XP formulas', () => {
  const state = createFreshState();
  const result = runWorkCycle(state, { random: () => 0 });

  assert.equal(result.ok, true);
  assert.equal(result.critical, true);
  assert.equal(result.amount, 2);
  assert.equal(result.xp, 10);
  assert.equal(state.inv.ironOre, 2);
  assert.equal(state.skills.mining.x, 10);
  assert.equal(skillXpNeeded(1), 32);
});

test('smelting consumes ore, produces bars, and stops cleanly when ore runs out', () => {
  const state = createFreshState();
  state.active = 'smelting';
  state.smelt = 'iron';
  state.inv.ironOre = 3;
  state.running = true;

  const first = runWorkCycle(state, { random: () => 0.9 });
  assert.equal(first.ok, true);
  assert.equal(state.inv.ironOre, 0);
  assert.equal(state.inv.ironBar, 1);

  const second = runWorkCycle(state, { random: () => 0.9 });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'ore-required');
  assert.equal(state.running, false);
});

test('visiting regional towns unlocks better smelting for their metal', () => {
  const state = createFreshState();
  state.open = 1;
  state.active = 'smelting';
  state.smelt = 'deepsteel';
  state.inv.deepsteelOre = 12;
  const before = runWorkCycle(state, { random: () => 0.99 });
  state.journey.towns.frostmere = true;
  const rolls = [0.9, 0.9, 0.05];
  const after = runWorkCycle(state, { random: () => rolls.shift() ?? 0.9 });
  assert.equal(before.amount, 1);
  assert.equal(after.amount, 2);
});

test('opened mine depths still enforce the original mining level requirement', () => {
  const state = createFreshState();
  state.open = 1;
  assert.equal(selectMineDepth(state, 1).code, 'skill-required');
  state.skills.mining.l = 5;
  assert.equal(selectMineDepth(state, 1).ok, true);
  assert.equal(state.depth, 1);
});

test('smelting and forging cannot bypass unopened metal tiers', () => {
  const state = createFreshState();
  state.skills.smelting.l = 20;
  state.skills.forging.l = 20;
  state.inv.deepsteelOre = 3;
  state.inv.deepsteelBar = 3;
  assert.equal(selectSmeltMetal(state, 'deepsteel').code, 'locked-metal');
  assert.equal(forgeItem(state, 'ds').code, 'locked-metal');
  state.open = 1;
  assert.equal(selectSmeltMetal(state, 'deepsteel').ok, true);
});

test('offline work uses the original cycle duration and capped cycle simulation', () => {
  const state = createFreshState();
  state.running = true;
  state.view = 'work';
  state.last = 1_000;
  const cycle = getCycleSeconds(state, 'mining');
  const result = simulateOfflineWork(state, { now: 11_000, random: () => 0.9 });

  assert.equal(cycle, 3.2);
  assert.equal(result.cycles, 3);
  assert.equal(state.inv.ironOre, 9);
});

test('forging retains requirements, quality rolls, item stats, IDs, and XP', () => {
  const state = createFreshState();
  state.inv.ironBar = 3;
  const result = forgeItem(state, 'is', { random: () => 0 });

  assert.equal(result.ok, true);
  assert.equal(result.quality, 'Masterwork');
  assert.equal(result.item.id, 1);
  assert.equal(result.item.name, 'Masterwork Iron Longsword');
  assert.equal(result.item.atk, 5);
  assert.equal(result.item.val, 47);
  assert.equal(state.inv.ironBar, 0);
  assert.equal(state.gid, 2);
  assert.equal(state.skills.forging.x, 29);
});

test('equipment stats follow six persistent slots and market refuses equipped sales', () => {
  const state = createFreshState();
  state.gear.push(
    { id: 1, name: 'Blade', type: 'weapon', atk: 4, def: 0, val: 30 },
    { id: 2, name: 'Mail', type: 'chest', atk: 0, def: 5, val: 60 }
  );
  assert.equal(equipItem(state, 'weapon', 1).ok, true);
  assert.equal(equipItem(state, 'chest', 2).ok, true);
  assert.deepEqual({ atk: getEquipment(state).atk, def: getEquipment(state).def }, { atk: 4, def: 5 });
  assert.equal(sellGear(state, 1).code, 'equipped');
  assert.equal(equipItem(state, 'weapon', null).ok, true);
  assert.equal(sellGear(state, 1).coins, 30);
});

test('town restoration and market multipliers preserve the original progression', () => {
  const state = createFreshState();
  state.coins = 500;
  assert.equal(getTownCost(state, 'inn'), 60);
  assert.equal(restoreTown(state, 'inn').level, 1);
  assert.equal(getTownCost(state, 'inn'), 108);

  state.town.market = 3;
  assert.equal(getMarketMultiplier(state), 1.1);
  state.inv.ironOre = 10;
  const sale = sellMaterial(state, 'ironOre', 2, 'all');
  assert.equal(sale.coins, 22);
  assert.equal(state.inv.ironOre, 0);
});
