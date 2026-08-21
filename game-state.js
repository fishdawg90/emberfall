// Renderer-independent state compatibility layer for the original Emberfall
// gameplay. Keep this file free of DOM, Three.js, and scene assumptions so the
// rules can be moved in small, testable slices.

export const CANONICAL_SAVE_KEY = 'emberfall_depths_v4';
export const COMPATIBLE_SAVE_KEYS = Object.freeze([
  CANONICAL_SAVE_KEY,
  'emberfall_depths_v20_5',
  'emberfall_depths_v20_6'
]);

const METAL_IDS = Object.freeze(['iron', 'deepsteel', 'starsilver', 'aetherite']);
const SKILL_IDS = Object.freeze(['mining', 'smelting', 'combat', 'forging']);
const UPGRADE_IDS = Object.freeze(['speed', 'yield', 'keen', 'crit', 'power']);
const EXPLORE_AREAS = Object.freeze(['world', 'town', 'cave', 'forest']);

function freshExplore() {
  return {
    active: true,
    area: 'world',
    step: 0,
    best: 0,
    runs: 0,
    hp: 0,
    maxHp: 0,
    choices: [],
    history: [],
    combat: null,
    pending: null,
    buffs: { dmg: 0, brk: 0, block: 0 },
    haul: { coins: 0, ore: {} },
    result: null,
    roomSeed: 1,
    worldSeed: Math.floor(Math.random() * 900000) + 100000,
    worldPos: [0, 7.2],
    townPos: [0, 7.2],
    regionWins: { world: 0, cave: 0, forest: 0 },
    claimed: { town: true, cave: false, forest: false },
    encounterDist: 0,
    nextEncounter: 11,
    encounters: 0
  };
}

function freshSkills() {
  const skills = {};
  const up = {};
  for (const id of SKILL_IDS) {
    skills[id] = { l: 1, x: 0, s: 0 };
    up[id] = Object.fromEntries(UPGRADE_IDS.map(key => [key, 0]));
  }
  return { skills, up };
}

export function createFreshState() {
  const inv = { gems: 0 };
  for (const metal of METAL_IDS) {
    inv[`${metal}Ore`] = 0;
    inv[`${metal}Bar`] = 0;
  }

  const { skills, up } = freshSkills();
  return {
    coins: 55,
    last: Date.now(),
    active: 'mining',
    running: false,
    p: 0,
    op: 0,
    rad: false,
    depth: 0,
    open: 0,
    smelt: 'iron',
    skills,
    up,
    inv,
    gear: [],
    eq: { weapon: null, head: null, chest: null, hands: null, legs: null, feet: null },
    gid: 1,
    view: 'explore',
    sound: true,
    battle: null,
    selectedRecipe: 'is',
    forgeAnim: null,
    hero: { level: 1, xp: 0 },
    town: { forge: 1, smelter: 1, market: 1, inn: 0 },
    journey: {
      introSeen: false,
      activeMission: null,
      towns: { town: true, frostmere: false, sunspire: false, tidewatch: false },
      services: { mine: false, smelter: false, forge: false, market: false },
      tradeCoins: 0
    },
    unifiedV20: true,
    explore: freshExplore()
  };
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function pairOr(value, fallback) {
  return Array.isArray(value) && value.length >= 2 && value.every(Number.isFinite)
    ? [value[0], value[1]]
    : [...fallback];
}

function normalizeExplore(rawExplore, raw) {
  const base = freshExplore();
  const source = objectOrEmpty(rawExplore);
  const legacyArea = raw.area || raw.region;
  const explore = { ...base, ...source };

  // Older saves sometimes kept these fields beside the exploration object.
  if (!source.area && EXPLORE_AREAS.includes(legacyArea)) explore.area = legacyArea;
  if (!source.worldPos && raw.worldPos) explore.worldPos = raw.worldPos;
  if (!source.townPos && raw.townPos) explore.townPos = raw.townPos;
  if (!source.regionWins && raw.regionWins) explore.regionWins = raw.regionWins;
  if (!source.claimed && raw.claimed) explore.claimed = raw.claimed;

  explore.area = EXPLORE_AREAS.includes(explore.area) ? explore.area : 'world';
  explore.worldPos = pairOr(explore.worldPos, base.worldPos);
  explore.townPos = pairOr(explore.townPos, base.townPos);
  explore.regionWins = { ...base.regionWins, ...objectOrEmpty(explore.regionWins) };
  explore.claimed = { ...base.claimed, ...objectOrEmpty(explore.claimed) };
  explore.buffs = { ...base.buffs, ...objectOrEmpty(explore.buffs) };
  explore.haul = {
    ...base.haul,
    ...objectOrEmpty(explore.haul),
    ore: { ...base.haul.ore, ...objectOrEmpty(explore.haul?.ore) }
  };
  explore.choices = arrayOrEmpty(explore.choices);
  explore.history = arrayOrEmpty(explore.history);
  explore.combat = explore.combat && typeof explore.combat === 'object'
    ? { ...explore.combat, anim: null, enemyAnim: null, resolving: false, playerHitUntil: 0 }
    : null;
  return explore;
}

function normalizeEquipment(raw) {
  const source = objectOrEmpty(raw);
  const eq = {
    weapon: null,
    head: null,
    chest: null,
    hands: null,
    legs: null,
    feet: null,
    ...source
  };
  // The old equipment schema called the chest slot "armor".
  if (source.armor != null && eq.chest == null) eq.chest = source.armor;
  delete eq.armor;
  return eq;
}

function normalizeGear(raw) {
  return arrayOrEmpty(raw).map(item => {
    if (!item || typeof item !== 'object') return item;
    return item.type === 'armor' ? { ...item, type: 'chest' } : { ...item };
  });
}

/**
 * Normalize a save while retaining unknown top-level fields. Retaining fields
 * is deliberate: a later gameplay slice may not understand every field from
 * an older build, but it should not delete that data when it saves again.
 */
export function normalizeSave(raw) {
  const base = createFreshState();
  const source = objectOrEmpty(raw);
  const merged = { ...base, ...source };

  merged.coins = finiteOr(source.coins, base.coins);
  merged.last = finiteOr(source.last, base.last);
  merged.depth = Math.max(0, Math.floor(finiteOr(source.depth, base.depth)));
  merged.open = Math.max(0, Math.floor(finiteOr(source.open, base.open)));
  merged.gid = Math.max(1, Math.floor(finiteOr(source.gid, base.gid)));
  merged.skills = {};
  merged.up = {};

  for (const id of SKILL_IDS) {
    merged.skills[id] = { ...base.skills[id], ...objectOrEmpty(source.skills?.[id]) };
    merged.up[id] = { ...base.up[id], ...objectOrEmpty(source.up?.[id]) };
  }

  merged.inv = { ...base.inv, ...objectOrEmpty(source.inv) };
  merged.eq = normalizeEquipment(source.eq);
  merged.gear = normalizeGear(source.gear);
  merged.hero = { ...base.hero, ...objectOrEmpty(source.hero) };
  merged.town = { ...base.town, ...objectOrEmpty(source.town) };
  merged.journey = {
    ...base.journey,
    ...objectOrEmpty(source.journey),
    towns: { ...base.journey.towns, ...objectOrEmpty(source.journey?.towns) },
    services: { ...base.journey.services, ...objectOrEmpty(source.journey?.services) },
    tradeCoins: Math.max(0, finiteOr(source.journey?.tradeCoins, base.journey.tradeCoins))
  };
  merged.journey.activeMission = typeof source.journey?.activeMission === 'string'
    ? source.journey.activeMission
    : null;
  if (!source.journey?.services) {
    const progressed = Boolean(source.eq?.weapon)
      || (Number(source.open) || 0) > 0
      || Object.entries(objectOrEmpty(source.journey?.towns)).some(([id, visited]) => id !== 'town' && visited);
    if (progressed) {
      merged.journey.services = { mine: true, smelter: true, forge: true, market: true };
      merged.journey.tradeCoins = Math.max(15, merged.journey.tradeCoins);
    }
  }
  merged.explore = normalizeExplore(source.explore, source);
  merged.forgeAnim = null;

  // The original v20 migration defaults an old, non-unified save to Greyfen.
  // Preserve that behavior only when the save clearly predates the unified
  // exploration model; modern saves keep their explicit area/view.
  if (!source.unifiedV20 && !source.explore?.area) {
    merged.view = 'explore';
    merged.explore.area = source.explore?.active ? 'cave' : 'town';
  }
  merged.unifiedV20 = true;
  return merged;
}

function readJson(storage, key, errors) {
  try {
    const text = storage?.getItem(key);
    if (!text) return null;
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch (error) {
    errors.push({ key, message: String(error?.message || error) });
    return null;
  }
}

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch (_) {
    return null;
  }
}

/**
 * Read all known aliases and select the newest state by its `last` timestamp.
 * On a tie, the requested v4 key wins. No storage is written by this function.
 */
export function loadGameState(storage = defaultStorage()) {
  const errors = [];
  const candidates = COMPATIBLE_SAVE_KEYS
    .map((key, order) => {
      const raw = readJson(storage, key, errors);
      return raw ? { key, order, raw, last: finiteOr(raw.last, 0) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.last - a.last || a.order - b.order);
  const selected = candidates[0];
  return {
    state: normalizeSave(selected?.raw),
    found: Boolean(selected),
    sourceKey: selected?.key || null,
    compatibleKeys: [...COMPATIBLE_SAVE_KEYS],
    errors
  };
}

/**
 * Save through the canonical v4 key and the attached build's v20.5 alias.
 * Gameplay services call this only after an explicit player action or a
 * completed production cycle, preventing a read-only boot from overwriting a
 * real save while keeping the migrated runtime persistent.
 */
export function saveGameState(state, storage = defaultStorage()) {
  const normalized = normalizeSave(state);
  normalized.last = Date.now();
  const serialized = JSON.stringify(normalized);
  const written = [];
  const errors = [];
  for (const key of [CANONICAL_SAVE_KEY, 'emberfall_depths_v20_5']) {
    try {
      storage?.setItem(key, serialized);
      if (storage) written.push(key);
    } catch (error) {
      errors.push({ key, message: String(error?.message || error) });
    }
  }
  return { state: normalized, written, errors };
}

/**
 * Clear every compatible alias before writing a brand-new state. Removing all
 * aliases prevents a newer legacy timestamp from resurrecting old progress.
 */
export function resetGameState(storage = defaultStorage()) {
  const removed = [];
  const errors = [];
  for (const key of COMPATIBLE_SAVE_KEYS) {
    try {
      storage?.removeItem?.(key);
      if (storage) removed.push(key);
    } catch (error) {
      errors.push({ key, message: String(error?.message || error) });
    }
  }
  const saved = saveGameState(createFreshState(), storage);
  return { ...saved, removed, errors: [...errors, ...saved.errors] };
}

export function getSaveSummary(state) {
  const normalized = normalizeSave(state);
  const regionWins = normalized.explore.regionWins;
  return {
    coins: normalized.coins,
    heroLevel: normalized.hero.level,
    mineDepth: normalized.open,
    gearCount: normalized.gear.length,
    restoredBuildings: Object.values(normalized.town).filter(value => Number(value) > 0).length,
    regionWins: { ...regionWins },
    hasCombatState: Boolean(normalized.explore.combat)
  };
}
