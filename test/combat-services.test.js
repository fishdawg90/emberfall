import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshState } from '../game-state.js';
import {
  endExploreTurn,
  getCardNumbers,
  getCombatDeck,
  getExploreMaxHp,
  playExploreCard,
  startExploreCombat
} from '../combat-services.js';

test('combat deck follows hero levels and equipped weapon metal', () => {
  const state = createFreshState();
  assert.deepEqual(getCombatDeck(state), ['slash', 'slash', 'splitter', 'splitter', 'guard', 'guard', 'feint', 'heavy', 'slash']);
  state.hero.level = 4;
  state.gear.push({ id: 1, name: 'Deepsteel Blade', type: 'weapon', atk: 8, def: 0, recipe: 'ds' });
  state.eq.weapon = 1;
  const deck = getCombatDeck(state);
  assert.equal(deck.includes('driving'), true);
  assert.equal(deck.includes('sunder'), true);
});

test('exploration HP and card bonuses use hero, equipment, inn, and run buffs', () => {
  const state = createFreshState();
  state.hero.level = 3;
  state.town.inn = 2;
  state.gear.push({ id: 1, name: 'Blade', type: 'weapon', atk: 8, def: 0 }, { id: 2, name: 'Mail', type: 'chest', atk: 0, def: 6 });
  state.eq.weapon = 1;
  state.eq.chest = 2;
  state.explore.buffs = { dmg: 1, brk: 2, block: 1 };
  assert.equal(getExploreMaxHp(state), 60);
  assert.deepEqual(getCardNumbers(state, 'splitter'), { dmg: 5, brk: 5, block: 0 });
  assert.deepEqual(getCardNumbers(state, 'guard'), { dmg: 0, brk: 0, block: 7 });
});

test('combat start preserves scaling, energy, draw pile, hand, guard, and origin', () => {
  const state = createFreshState();
  state.explore.area = 'cave';
  state.explore.regionWins.cave = 2;
  const result = startExploreCombat(state, { random: () => 0, origin: { area: 'cave', pos: [4, 5], yaw: 1, z: 2 } });
  assert.equal(result.ok, true);
  assert.equal(result.combat.enemyId, 'stonehorn');
  assert.equal(result.combat.energy, 3);
  assert.equal(result.combat.hand.length, 4);
  assert.equal(result.combat.origin.yaw, 1);
  assert.equal(result.combat.guard, 11);
  assert.equal(result.combat.hp, 53);
});

test('Break cancels intent, boosts damage, resets guard, and draws a new turn', () => {
  const state = createFreshState();
  startExploreCombat(state, { random: () => 0.4 });
  const combat = state.explore.combat;
  combat.enemyId = 'scavenger';
  combat.hp = combat.maxHp = 24;
  combat.guard = combat.guardMax = 5;
  combat.hand = ['splitter', 'heavy'];
  combat.draw = ['guard', 'slash', 'feint', 'guard'];
  combat.discard = [];
  combat.energy = 3;

  assert.equal(playExploreCard(state, 0, { random: () => 0.5 }).damage, 2);
  const broken = playExploreCard(state, 0, { random: () => 0.5 });
  assert.equal(broken.justBroken, true);
  assert.equal(broken.damage, 12);
  assert.equal(combat.broken, true);
  const turn = endExploreTurn(state, { random: () => 0.5 });
  assert.equal(turn.staggered, true);
  assert.equal(turn.taken, 0);
  assert.equal(combat.guard, combat.guardMax);
  assert.equal(combat.turn, 2);
  assert.equal(combat.energy, 3);
  assert.equal(combat.hand.length, 4);
});

test('block absorbs enemy intent and is discarded at the next draw', () => {
  const state = createFreshState();
  startExploreCombat(state, { random: () => 0.4 });
  const combat = state.explore.combat;
  combat.enemyId = 'scavenger';
  combat.hand = ['guard'];
  combat.draw = ['slash', 'slash', 'guard', 'feint'];
  combat.discard = [];
  const hp = state.explore.hp;
  playExploreCard(state, 0);
  const result = endExploreTurn(state, { random: () => 0.5 });
  assert.equal(result.absorbed, 5);
  assert.equal(result.taken, 2);
  assert.equal(state.explore.hp, hp - 2);
  assert.equal(combat.block, 0);
});

test('victory awards original rewards and advances region progression', () => {
  const state = createFreshState();
  startExploreCombat(state, { random: () => 0.4 });
  const combat = state.explore.combat;
  combat.enemyId = 'scavenger';
  combat.hp = 1;
  combat.hand = ['slash'];
  combat.energy = 3;
  const result = playExploreCard(state, 0, { random: () => 0 });
  assert.equal(result.victory, true);
  assert.equal(result.coins, 7);
  assert.equal(result.xp, 12);
  assert.equal(state.explore.combat, null);
  assert.equal(state.explore.regionWins.world, 1);
  assert.equal(state.explore.encounters, 1);
});

test('cave boss victory secures the region and opens Deepsteel progression', () => {
  const state = createFreshState();
  state.explore.area = 'cave';
  state.explore.regionWins.cave = 2;
  startExploreCombat(state, { boss: true, random: () => 0 });
  const combat = state.explore.combat;
  combat.hp = 1;
  combat.hand = ['slash'];
  combat.energy = 3;
  const result = playExploreCard(state, 0, { random: () => 0 });
  assert.equal(result.victory, true);
  assert.equal(result.boss, true);
  assert.equal(state.explore.claimed.cave, true);
  assert.equal(state.explore.regionWins.cave, 3);
  assert.equal(state.open, 1);
  assert.equal(state.explore.pending.title, 'Lower Ways secured');
});

test('defeat returns the hero to Greyfen with restored expedition HP', () => {
  const state = createFreshState();
  startExploreCombat(state, { random: () => 0.4 });
  state.explore.hp = 1;
  state.explore.combat.block = 0;
  const result = endExploreTurn(state, { random: () => 0.5 });
  assert.equal(result.defeat, true);
  assert.equal(state.explore.combat, null);
  assert.equal(state.explore.area, 'town');
  assert.deepEqual(state.explore.townPos, [0, 12.4]);
  assert.equal(state.explore.hp, state.explore.maxHp);
});
