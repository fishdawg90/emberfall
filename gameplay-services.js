import {
  ACTIVITIES,
  EQUIPMENT_SLOTS,
  METALS,
  RECIPES,
  TOWN_PROJECTS,
  UPGRADES
} from './game-catalog.js';

const ACTIVITY_IDS = Object.freeze(Object.keys(ACTIVITIES));
const METAL_IDS = Object.freeze(METALS.map(metal => metal.id));
const OFFLINE_CAP_MS = 43_200_000;

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function randomSource(random) {
  return typeof random === 'function' ? random : Math.random;
}

function randomInt(min, max, random) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function scaled(value, multiplier, random) {
  const result = value * multiplier;
  const floor = Math.floor(result);
  return floor + (random() < result - floor ? 1 : 0);
}

export function skillXpNeeded(level) {
  return Math.floor(32 * level ** 1.34);
}

export function heroXpNeeded(level) {
  return Math.round(28 + 22 * level + 7 * level * level);
}

export function getTownLevel(state, id) {
  return Number(state.town?.[id]) || 0;
}

export function getTownCost(state, id) {
  const project = TOWN_PROJECTS[id];
  if (!project) return Infinity;
  return Math.round(project.base * (1 + getTownLevel(state, id) * 0.8));
}

export function getMarketMultiplier(state) {
  return 1 + (Math.max(1, getTownLevel(state, 'market')) - 1) * 0.05;
}

export function getSmelterMultiplier(state) {
  return 1 + (Math.max(1, getTownLevel(state, 'smelter')) - 1) * 0.08;
}

export function getUpgradeRank(state, activity, upgrade) {
  return Number(state.up?.[activity]?.[upgrade]) || 0;
}

export function getCriticalChance(state, activity) {
  return Math.min(0.48, 0.035 + getUpgradeRank(state, activity, 'crit') * 0.0275);
}

export function getCriticalPower(state, activity) {
  return 1.75 + getUpgradeRank(state, activity, 'power') * 0.32;
}

export function getYieldMultiplier(state, activity) {
  return 1.085 ** getUpgradeRank(state, activity, 'yield');
}

export function getCycleSeconds(state, activity = state.active) {
  const definition = ACTIVITIES[activity];
  const skill = state.skills?.[activity];
  if (!definition || !skill) return Infinity;
  const levelBonus = 1 + Math.min(0.42, (skill.l - 1) * 0.018);
  const veteranBonus = skill.l >= 10 ? 1.1 : 1;
  return definition.seconds / (1.055 ** getUpgradeRank(state, activity, 'speed') * levelBonus * veteranBonus);
}

export function getOpportunitySeconds(state, activity = state.active) {
  return Math.max(3.2, (9.5 - state.skills[activity].l * 0.1) / 1.075 ** getUpgradeRank(state, activity, 'keen'));
}

export function getRadiantChance(state, activity = state.active) {
  return Math.min(0.42, 0.05 + getUpgradeRank(state, activity, 'keen') * 0.025);
}

export function getActivityXp(state, activity = state.active) {
  const definition = ACTIVITIES[activity];
  const skill = state.skills?.[activity];
  if (!definition || !skill) return 0;
  let value = definition.xp * (1 + Math.min(0.35, (skill.l - 1) * 0.012));
  if (activity === 'mining') value *= [1, 1.65, 2.45, 3.55][state.depth] || 1;
  if (activity === 'smelting') value *= [1, 1.55, 2.3, 3.35][Math.max(0, METALS.findIndex(metal => metal.id === state.smelt))] || 1;
  return Math.round(value);
}

export function getForgeXp(recipe) {
  const tier = Math.max(0, METALS.findIndex(metal => metal.id === recipe.m));
  return Math.round(16 + recipe.req * 4 + recipe.bars * 3 + tier * 10);
}

export function addSkillXp(state, activity, amount) {
  const skill = state.skills?.[activity];
  if (!skill || !Number.isFinite(amount) || amount <= 0) return fail('invalid-skill', 'That skill cannot gain XP.');
  const fromLevel = skill.l;
  skill.x += amount;
  skill.s += amount;
  while (skill.x >= skillXpNeeded(skill.l)) {
    skill.x -= skillXpNeeded(skill.l);
    skill.l += 1;
  }
  return { ok: true, amount, fromLevel, toLevel: skill.l, levels: skill.l - fromLevel };
}

export function addHeroXp(state, amount) {
  const hero = state.hero;
  const fromLevel = hero.level;
  hero.xp += amount;
  while (hero.xp >= heroXpNeeded(hero.level)) {
    hero.xp -= heroXpNeeded(hero.level);
    hero.level += 1;
  }
  return { ok: true, amount, fromLevel, toLevel: hero.level, levels: hero.level - fromLevel };
}

export function getEquipment(state) {
  const byId = new Map(state.gear.map(item => [item.id, item]));
  const items = {};
  let atk = 0;
  let def = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = byId.get(state.eq?.[slot.id]) || null;
    items[slot.id] = item;
    atk += item?.atk || 0;
    def += item?.def || 0;
  }
  return { ...items, atk, def };
}

export function isEquipped(state, id) {
  return EQUIPMENT_SLOTS.some(slot => state.eq?.[slot.id] === id);
}

export function equipItem(state, slot, id) {
  if (!EQUIPMENT_SLOTS.some(entry => entry.id === slot)) return fail('invalid-slot', 'Unknown equipment slot.');
  if (id == null) {
    state.eq[slot] = null;
    return { ok: true, slot, item: null };
  }
  const item = state.gear.find(entry => entry.id === id);
  if (!item) return fail('missing-item', 'That item is no longer in your inventory.');
  if (item.type !== slot) return fail('wrong-slot', `${item.name} cannot be equipped there.`);
  state.eq[slot] = id;
  return { ok: true, slot, item };
}

export function selectActivity(state, activity) {
  if (!ACTIVITY_IDS.includes(activity)) return fail('invalid-activity', 'Unknown production activity.');
  state.active = activity;
  state.running = false;
  state.p = 0;
  state.op = 0;
  return { ok: true, activity };
}

export function selectMineDepth(state, depth) {
  const index = Number(depth);
  const metal = METALS[index];
  if (!metal) return fail('invalid-depth', 'Unknown mine depth.');
  if (index > state.open) return fail('locked-depth', `${metal.place} has not been opened yet.`);
  state.depth = index;
  return selectActivity(state, 'mining');
}

export function selectSmeltMetal(state, metalId) {
  const metal = METALS.find(entry => entry.id === metalId);
  if (!metal) return fail('invalid-metal', 'Unknown metal.');
  if ((state.skills?.smelting?.l || 1) < metal.smelt) return fail('skill-required', `Smelting level ${metal.smelt} required.`);
  state.smelt = metalId;
  return selectActivity(state, 'smelting');
}

export function runWorkCycle(state, options = {}) {
  const random = randomSource(options.random);
  const activity = state.active;
  if (!ACTIVITY_IDS.includes(activity)) return fail('invalid-activity', 'Unknown production activity.');
  const critical = random() < getCriticalChance(state, activity);
  const multiplier = getYieldMultiplier(state, activity) * (critical ? getCriticalPower(state, activity) : 1);
  let amount = 1;
  let metal = null;
  let kind = 'xp';

  if (activity === 'mining') {
    metal = METALS[state.depth];
    if (!metal || state.depth > state.open) return fail('locked-depth', 'That mine depth is not available.');
    amount = Math.max(1, scaled(randomInt(metal.yield[0], metal.yield[1], random), multiplier, random));
    state.inv[`${metal.id}Ore`] += amount;
    kind = 'ore';
  } else if (activity === 'smelting') {
    metal = METALS.find(entry => entry.id === state.smelt);
    if (!metal) return fail('invalid-metal', 'Choose a metal to smelt.');
    const oreKey = `${metal.id}Ore`;
    if (state.inv[oreKey] < metal.cost) {
      state.running = false;
      return fail('ore-required', `Need ${metal.cost} ${metal.name} ore.`, { metal });
    }
    state.inv[oreKey] -= metal.cost;
    amount = Math.max(1, scaled(1, multiplier, random));
    amount = Math.max(1, scaled(amount, getSmelterMultiplier(state), random));
    state.inv[`${metal.id}Bar`] += amount;
    kind = 'bar';
  }

  let xp = getActivityXp(state, activity);
  if (critical) xp = Math.round(xp * 1.2);
  const progress = addSkillXp(state, activity, xp);
  return { ok: true, activity, critical, amount, xp, kind, metal, progress };
}

export function runOpportunity(state, options = {}) {
  if (!state.running || state.op < 1) return fail('not-ready', 'No opportunity is ready.');
  const activity = state.active;
  const radiant = Boolean(state.rad);
  let amount = 0;
  let xp = 0;
  let metal = null;

  if (activity === 'mining') {
    metal = METALS[state.depth];
    amount = radiant ? 3 : 1;
    state.inv[`${metal.id}Ore`] += amount;
    if (radiant) {
      state.inv.gems += 1;
      state.coins += 5;
    }
    state.p = Math.min(0.96, state.p + (radiant ? 0.56 : 0.34));
  } else if (activity === 'smelting') {
    metal = METALS.find(entry => entry.id === state.smelt);
    const tier = Math.max(0, METALS.findIndex(entry => entry.id === state.smelt));
    xp = Math.round((radiant ? 7 : 3) * ([1, 1.5, 2.2, 3.2][tier] || 1));
    addSkillXp(state, 'smelting', xp);
    state.p = Math.min(0.96, state.p + (radiant ? 0.62 : 0.46));
    if (radiant) {
      amount = 1;
      state.inv[`${metal.id}Bar`] += 1;
    }
  } else if (activity === 'combat') {
    xp = radiant ? 12 : 5;
    addSkillXp(state, 'combat', xp);
    state.p = Math.min(0.96, state.p + (radiant ? 0.5 : 0.3));
  } else {
    return fail('invalid-activity', 'Unknown production activity.');
  }

  state.op = 0;
  state.rad = false;
  return { ok: true, activity, radiant, amount, xp, metal };
}

export function simulateOfflineWork(state, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const random = randomSource(options.random);
  const elapsed = Math.max(0, Math.min(OFFLINE_CAP_MS, now - (state.last || now)));
  if (!state.running || (options.requireWorkView !== false && state.view !== 'work') || elapsed < 5000) {
    return { ok: true, cycles: 0, elapsed };
  }
  const cycles = Math.min(25_000, Math.floor(elapsed / 1000 / getCycleSeconds(state)));
  let completed = 0;
  let lastResult = null;
  for (let index = 0; index < cycles; index += 1) {
    lastResult = runWorkCycle(state, { random });
    if (!lastResult.ok) break;
    completed += 1;
  }
  state.p = 0;
  state.op = 0;
  return { ok: true, cycles: completed, elapsed, lastResult };
}

export function forgeItem(state, recipeId = state.selectedRecipe, options = {}) {
  const random = randomSource(options.random);
  const recipe = RECIPES.find(entry => entry.id === recipeId);
  if (!recipe) return fail('invalid-recipe', 'Unknown forge recipe.');
  const metal = METALS.find(entry => entry.id === recipe.m);
  const barKey = `${metal.id}Bar`;
  if (state.skills.forging.l < recipe.req) return fail('skill-required', `Forge level ${recipe.req} required.`, { recipe });
  if (state.inv[barKey] < recipe.bars) return fail('bars-required', `Need ${recipe.bars} ${metal.bar}${recipe.bars === 1 ? '' : 's'}.`, { recipe, metal });

  state.inv[barKey] -= recipe.bars;
  const townForge = Math.max(1, getTownLevel(state, 'forge'));
  const masterChance = 0.06 + Math.min(0.18, state.skills.forging.l * 0.008) + (townForge - 1) * 0.025;
  const fineChance = 0.30 + (townForge - 1) * 0.04;
  const roll = random();
  const quality = roll < masterChance ? 'Masterwork' : roll < fineChance ? 'Fine' : 'Standard';
  const statMultiplier = quality === 'Masterwork' ? 1.28 : quality === 'Fine' ? 1.12 : 1;
  const valueMultiplier = quality === 'Masterwork' ? 1.55 : quality === 'Fine' ? 1.22 : 1;
  const item = {
    id: state.gid++,
    name: `${quality === 'Standard' ? '' : `${quality} `}${recipe.name}`,
    type: recipe.type,
    atk: Math.round(recipe.atk * statMultiplier),
    def: Math.round(recipe.def * statMultiplier),
    val: Math.round(recipe.val * valueMultiplier),
    q: quality,
    recipe: recipe.id
  };
  state.gear.push(item);
  state.selectedRecipe = recipe.id;
  const progress = addSkillXp(state, 'forging', getForgeXp(recipe));
  return { ok: true, recipe, metal, item, quality, masterChance, fineChance, progress };
}

export function getUpgradeCost(state, activity, upgradeId) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade || !state.skills?.[activity]) return Infinity;
  const rank = getUpgradeRank(state, activity, upgradeId);
  return rank >= upgrade.cap ? Infinity : upgrade.cost(rank);
}

export function buyUpgrade(state, activity, upgradeId) {
  const upgrade = UPGRADES[upgradeId];
  const cost = getUpgradeCost(state, activity, upgradeId);
  if (!upgrade || !Number.isFinite(cost)) return fail('maxed', 'That upgrade is already maxed.');
  if (upgrade.currency === 'coin') {
    if (state.coins < cost) return fail('coin-required', `Need ${cost} coin.`);
    state.coins -= cost;
  } else {
    if (state.skills[activity].s < cost) return fail('xp-required', `Need ${cost} skill XP.`);
    state.skills[activity].s -= cost;
  }
  state.up[activity][upgradeId] += 1;
  return { ok: true, activity, upgradeId, rank: state.up[activity][upgradeId], cost, currency: upgrade.currency };
}

export function restoreTown(state, id) {
  const project = TOWN_PROJECTS[id];
  const level = getTownLevel(state, id);
  if (!project) return fail('invalid-project', 'Unknown Greyfen project.');
  if (level >= project.max) return fail('maxed', `${project.name} is fully restored.`);
  const cost = getTownCost(state, id);
  if (state.coins < cost) return fail('coin-required', `Need ${cost} coin.`, { cost, project });
  state.coins -= cost;
  state.town[id] = level + 1;
  return { ok: true, id, project, cost, level: level + 1 };
}

export function sellMaterial(state, key, unitPrice, amount = 1) {
  const available = Number(state.inv[key]) || 0;
  const count = Math.min(available, amount === 'all' ? Infinity : Math.max(0, Number(amount) || 0));
  if (!count) return fail('nothing-to-sell', 'There is nothing to sell.');
  state.inv[key] -= count;
  const coins = Math.round(count * unitPrice * getMarketMultiplier(state));
  state.coins += coins;
  return { ok: true, key, count, coins };
}

export function sellGear(state, id) {
  const index = state.gear.findIndex(item => item.id === id);
  if (index < 0) return fail('missing-item', 'That item is no longer in your inventory.');
  if (isEquipped(state, id)) return fail('equipped', 'Equipped items cannot be sold.');
  const [item] = state.gear.splice(index, 1);
  const coins = Math.round(item.val * getMarketMultiplier(state));
  state.coins += coins;
  return { ok: true, item, coins };
}

export function getMaterialRows(state) {
  return METALS.flatMap((metal, tier) => [
    { key: `${metal.id}Ore`, metal, tier, kind: 'ore', name: metal.ore, count: state.inv[`${metal.id}Ore`] || 0, value: metal.oreV },
    { key: `${metal.id}Bar`, metal, tier, kind: 'bar', name: metal.bar, count: state.inv[`${metal.id}Bar`] || 0, value: metal.barV }
  ]);
}

export function getGameplaySummary(state) {
  const equipment = getEquipment(state);
  return {
    activity: state.active,
    running: Boolean(state.running),
    cycleSeconds: getCycleSeconds(state),
    coins: state.coins,
    forgeLevel: state.skills.forging.l,
    atk: equipment.atk,
    def: equipment.def,
    town: { ...state.town },
    openMetalIds: METAL_IDS.slice(0, Math.min(METAL_IDS.length, state.open + 1))
  };
}
