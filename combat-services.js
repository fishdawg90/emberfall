import { EXPLORE_CARDS, EXPLORE_ENEMIES, METALS, RECIPES } from './game-catalog.js';
import { addHeroXp, getEquipment } from './gameplay-services.js';

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function randomSource(random) {
  return typeof random === 'function' ? random : Math.random;
}

function randomInt(min, max, random) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function ensureCombatCollections(combat) {
  combat.draw = Array.isArray(combat.draw) ? combat.draw : [];
  combat.discard = Array.isArray(combat.discard) ? combat.discard : [];
  combat.hand = Array.isArray(combat.hand) ? combat.hand : [];
  combat.energy = Number.isFinite(combat.energy) ? combat.energy : 3;
  combat.block = Number.isFinite(combat.block) ? combat.block : 0;
  combat.turn = Number.isFinite(combat.turn) ? combat.turn : 1;
  return combat;
}

export function shuffleCards(cards, random = Math.random) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function equippedWeaponCard(state) {
  const weapon = getEquipment(state).weapon;
  if (!weapon) return null;
  const recipe = RECIPES.find(entry => entry.id === weapon.recipe);
  const metal = recipe?.m || (/aetherite/i.test(weapon.name) ? 'aetherite' : /star-?silver/i.test(weapon.name) ? 'starsilver' : /deepsteel/i.test(weapon.name) ? 'deepsteel' : 'iron');
  return metal === 'aetherite' ? 'aetherbreak' : metal === 'starsilver' ? 'silvercut' : metal === 'deepsteel' ? 'sunder' : 'measured';
}

export function getCombatDeck(state) {
  const level = state.hero?.level || 1;
  let deck = ['slash', 'slash', 'splitter', 'splitter', 'guard', 'guard', 'feint', 'heavy'];
  if (level >= 2) {
    deck.push('brace');
    deck = deck.filter((card, index) => !(card === 'guard' && index === 5));
  }
  deck.push(level >= 4 ? 'driving' : 'slash');
  const weaponCard = equippedWeaponCard(state);
  if (weaponCard) {
    const slash = deck.indexOf('slash');
    if (slash >= 0) deck.splice(slash, 1);
    deck.push(weaponCard);
  }
  return deck.slice(0, 11);
}

export function getExploreMaxHp(state) {
  const equipment = getEquipment(state);
  const level = state.hero?.level || 1;
  const inn = state.town?.inn || 0;
  return Math.round(34 + level * 3.2 + equipment.def * 1.65 + inn * 3);
}

export function getExploreBonuses(state) {
  const equipment = getEquipment(state);
  const buffs = state.explore?.buffs || {};
  return {
    damage: Math.floor(equipment.atk * 0.32) + Math.floor(((state.hero?.level || 1) - 1) * 0.45) + (buffs.dmg || 0),
    block: Math.floor(equipment.def * 0.20) + (buffs.block || 0),
    break: buffs.brk || 0
  };
}

export function getCardNumbers(state, cardOrId) {
  const card = typeof cardOrId === 'string' ? EXPLORE_CARDS[cardOrId] : cardOrId;
  const bonuses = getExploreBonuses(state);
  return {
    dmg: card?.dmg ? card.dmg + bonuses.damage : 0,
    brk: card?.brk ? card.brk + bonuses.break : 0,
    block: card?.block ? card.block + bonuses.block : 0
  };
}

export function getCardText(state, cardOrId) {
  const card = typeof cardOrId === 'string' ? EXPLORE_CARDS[cardOrId] : cardOrId;
  if (!card) return '';
  const numbers = getCardNumbers(state, card);
  return card.text.replace('{dmg}', numbers.dmg).replace('{brk}', numbers.brk).replace('{block}', numbers.block);
}

export function getEnemyIntent(state, combat = state.explore?.combat) {
  if (!combat) return null;
  const enemy = EXPLORE_ENEMIES[combat.enemyId];
  if (!enemy) return null;
  const scale = combat.gateDepth ? 1 : 1 + state.explore.step * 0.08 + (combat.boss ? 0.12 : 0);
  if (combat.enemyId === 'tunnelmauler') {
    const heavy = combat.turn % 2 === 0;
    const dmg = Math.round((heavy ? enemy.dmg + 3 : enemy.dmg) * scale);
    return { name: heavy ? 'Tunnel Charge' : 'Rending Claw', dmg, hits: 1, text: `${dmg} damage` };
  }
  if (combat.enemyId === 'glasswarden') {
    const split = combat.turn % 3 === 0;
    const dmg = Math.round((split ? enemy.dmg - 3 : enemy.dmg) * scale);
    return { name: split ? 'Prism Volley' : 'Glass Edge', dmg, hits: split ? 2 : 1, text: split ? `${dmg} × 2 damage` : `${dmg} damage` };
  }
  if (combat.enemyId === 'abysssentinel') {
    const heavy = combat.turn % 3 === 0;
    const dmg = Math.round((heavy ? enemy.dmg + 5 : enemy.dmg) * scale);
    return { name: heavy ? 'Buried Starfall' : 'Aether Sweep', dmg, hits: 1, text: `${dmg} damage` };
  }
  if (combat.enemyId === 'stonehorn') {
    const heavy = combat.turn % 2 === 1;
    const dmg = Math.round((heavy ? enemy.dmg + 3 : enemy.dmg - 1) * scale);
    return { name: heavy ? 'Heavy Charge' : 'Headbutt', dmg, hits: 1, text: `${dmg} damage` };
  }
  if (combat.enemyId === 'crawler') {
    const dmg = Math.round(enemy.dmg * scale);
    return { name: 'Shard Volley', dmg, hits: 2, text: `${dmg} × 2 damage` };
  }
  if (combat.enemyId === 'custodian') {
    const heavy = combat.turn % 3 === 0;
    const dmg = Math.round((heavy ? enemy.dmg + 4 : enemy.dmg) * scale);
    return { name: heavy ? 'Gatebreaker' : 'Iron Sweep', dmg, hits: 1, text: `${dmg} damage` };
  }
  const dmg = Math.round(enemy.dmg * scale);
  return { name: 'Rusty Slash', dmg, hits: 1, text: `${dmg} damage` };
}

export function drawExploreCards(combat, count, random = Math.random) {
  for (let index = 0; index < count; index += 1) {
    if (!combat.draw.length) {
      if (!combat.discard.length) break;
      combat.draw = shuffleCards(combat.discard, random);
      combat.discard = [];
    }
    combat.hand.push(combat.draw.pop());
  }
  return combat.hand;
}

function enemyForStep(state, boss, random) {
  if (boss) return EXPLORE_ENEMIES.custodian;
  const order = ['scavenger', 'crawler', 'stonehorn'];
  return EXPLORE_ENEMIES[order[(state.explore.step + Math.floor(random() * 3)) % 3]];
}

export function startExploreCombat(state, options = {}) {
  if (state.explore.combat) return fail('combat-active', 'A battle is already active.');
  const random = randomSource(options.random);
  const boss = Boolean(options.boss);
  const gateDepth = Number.isInteger(options.gateDepth) && options.gateDepth > 0 && options.gateDepth < METALS.length ? options.gateDepth : null;
  const explore = state.explore;
  const area = options.origin?.area || explore.area || 'world';
  const wins = explore.regionWins?.[area] || 0;
  explore.step = wins;
  explore.maxHp = getExploreMaxHp(state);
  if (!explore.hp || explore.hp > explore.maxHp) explore.hp = explore.maxHp;
  const enemy = EXPLORE_ENEMIES[options.enemyId] || enemyForStep(state, boss, random);
  const areaBonus = area === 'cave' ? 0.18 : area === 'forest' ? 0.10 : 0;
  const scale = gateDepth ? 1 : 1 + wins * 0.14 + areaBonus + (boss ? 0.28 : 0);
  const guard = gateDepth ? enemy.guard : Math.round(enemy.guard * (1 + wins * 0.08 + areaBonus) + (boss ? 3 : 0));
  const position = options.origin?.pos || (area === 'world' ? explore.worldPos : area === 'town' ? explore.townPos : [0, 7.2]);
  const origin = options.origin || { area, pos: [...position], yaw: 0, z: 0 };
  const combat = {
    enemyId: enemy.id,
    boss,
    gateDepth,
    area,
    hp: Math.round(enemy.hp * scale),
    maxHp: Math.round(enemy.hp * scale),
    guard,
    guardMax: guard,
    broken: false,
    energy: 3,
    block: 0,
    turn: 1,
    draw: shuffleCards(getCombatDeck(state), random),
    discard: [],
    hand: [],
    log: `${enemy.name} blocks the path.`,
    anim: null,
    origin
  };
  drawExploreCards(combat, 4, random);
  explore.combat = combat;
  return { ok: true, combat, enemy };
}

function resolveVictory(state, combat, random) {
  const explore = state.explore;
  const enemy = EXPLORE_ENEMIES[combat.enemyId];
  const area = combat.area || explore.area || 'world';
  const wins = explore.regionWins?.[area] || 0;
  const gateMetal = combat.gateDepth ? METALS[combat.gateDepth] : null;
  const coins = gateMetal?.gate?.coin ?? (randomInt(7, 12, random) + wins * 3 + (combat.boss ? 28 : 0));
  const xp = gateMetal ? 24 + combat.gateDepth * 18 : 12 + wins * 5 + (combat.boss ? 24 : 0);
  state.coins += coins;
  explore.haul.coins += coins;
  const heroProgress = addHeroXp(state, xp);
  explore.encounters = (explore.encounters || 0) + 1;
  explore.combat = null;
  explore.encounterDist = 0;
  explore.nextEncounter = 10 + random() * 6;
  if (gateMetal) {
    state.open = Math.max(state.open, combat.gateDepth);
    explore.pending = {
      type: 'depth-opened',
      icon: gateMetal.icon,
      title: `${gateMetal.place} opened`,
      text: `${gateMetal.name} can now be mined once the required skill level is reached.`
    };
  } else if (combat.boss) {
    explore.claimed[area] = true;
    explore.regionWins[area] = Math.max(wins, 3);
    if (area === 'cave') {
      state.open = Math.max(state.open, 1);
      explore.pending = { type: 'secured', icon: '◆', title: 'Lower Ways secured', text: 'The main threat is gone. Greyfen can now work the Deepsteel routes, and this area is available for fast travel.' };
    } else if (area === 'forest') {
      explore.pending = { type: 'secured', icon: '♣', title: 'Whisperwood secured', text: 'The dangerous trail is under control. Whisperwood is now available for fast travel.' };
    } else {
      explore.pending = { type: 'secured', icon: '✦', title: 'Road secured', text: 'This stretch of Emberfall is safer now.' };
    }
  } else {
    explore.regionWins[area] = wins + 1;
    explore.step = explore.regionWins[area];
  }
  return { ok: true, victory: true, boss: combat.boss, enemy, coins, xp, heroProgress, area };
}

export function playExploreCard(state, index, options = {}) {
  const random = randomSource(options.random);
  const combat = state.explore?.combat && ensureCombatCollections(state.explore.combat);
  if (!combat) return fail('no-combat', 'There is no active battle.');
  if (combat.resolving) return fail('resolving', 'The enemy turn is resolving.');
  const cardId = combat.hand[index];
  const card = EXPLORE_CARDS[cardId];
  if (!card) return fail('missing-card', 'That card is no longer in your hand.');
  if (card.cost > combat.energy) return fail('energy-required', `Need ${card.cost} energy.`);

  combat.energy -= card.cost;
  combat.hand.splice(index, 1);
  combat.discard.push(cardId);
  const numbers = getCardNumbers(state, card);
  let justBroken = false;
  if (numbers.brk && !combat.broken) {
    combat.guard = Math.max(0, combat.guard - numbers.brk);
    if (combat.guard <= 0) {
      combat.broken = true;
      justBroken = true;
      combat.log = 'BROKEN — its intent is cancelled.';
    }
  }
  let damage = 0;
  if (numbers.dmg) {
    damage = Math.round(numbers.dmg * (combat.broken ? 1.28 : 1));
    combat.hp = Math.max(0, combat.hp - damage);
    combat.log = `${card.name}: ${damage} damage${numbers.brk ? ` · ${numbers.brk} Break` : ''}.`;
  }
  if (numbers.block) {
    combat.block += numbers.block;
    combat.log = `${card.name}: +${numbers.block} Block.`;
  }
  if (card.draw) drawExploreCards(combat, card.draw, random);
  if (justBroken && numbers.dmg) combat.log = `${card.name} BREAKS ${EXPLORE_ENEMIES[combat.enemyId].name} · ${damage} damage.`;
  if (combat.hp <= 0) return { ...resolveVictory(state, combat, random), card, cardId, damage, numbers, justBroken };
  return { ok: true, victory: false, card, cardId, damage, numbers, justBroken, combat };
}

function finishEnemyTurn(combat, random) {
  combat.block = 0;
  combat.discard.push(...combat.hand);
  combat.hand = [];
  combat.energy = 3;
  combat.turn += 1;
  combat.resolving = false;
  combat.enemyAnim = null;
  if (combat.broken) combat.broken = false;
  drawExploreCards(combat, 4, random);
}

function loseExploreCombat(state) {
  const explore = state.explore;
  explore.combat = null;
  explore.pending = null;
  explore.area = 'town';
  explore.townId = 'town';
  explore.active = true;
  explore.maxHp = getExploreMaxHp(state);
  explore.hp = explore.maxHp;
  explore.encounterDist = 0;
  explore.nextEncounter = 11;
  explore.townPos = [0, 12.4];
  return { ok: true, defeat: true, area: 'town' };
}

export function endExploreTurn(state, options = {}) {
  const random = randomSource(options.random);
  const combat = state.explore?.combat && ensureCombatCollections(state.explore.combat);
  if (!combat) return fail('no-combat', 'There is no active battle.');
  if (combat.resolving) return fail('resolving', 'The enemy turn is already resolving.');
  const intent = getEnemyIntent(state, combat);
  const enemy = EXPLORE_ENEMIES[combat.enemyId];
  let taken = 0;
  let absorbed = 0;
  let staggered = false;
  if (combat.broken) {
    staggered = true;
    combat.log = `${enemy.name} staggers. Its attack collapses.`;
    combat.guard = combat.guardMax;
  } else {
    const total = intent.dmg * intent.hits;
    absorbed = Math.min(combat.block, total);
    taken = Math.max(0, total - combat.block);
    state.explore.hp = Math.max(0, state.explore.hp - taken);
    combat.log = `${intent.name}: ${taken} damage${absorbed ? ` (${absorbed} blocked)` : ''}.`;
  }
  if (state.explore.hp <= 0) return { ...loseExploreCombat(state), intent, taken, absorbed, staggered };
  finishEnemyTurn(combat, random);
  return { ok: true, defeat: false, intent, taken, absorbed, staggered, combat };
}

export function registerTravelDistance(state, distance, options = {}) {
  const explore = state.explore;
  const area = explore.area || 'world';
  if (explore.combat || explore.pending || options.suppressed || area === 'town') return { ok: true, started: false };
  explore.encounterDist = (explore.encounterDist || 0) + Math.max(0, distance);
  if (explore.encounterDist < (explore.nextEncounter || 11)) return { ok: true, started: false, distance: explore.encounterDist };
  explore.encounterDist = 0;
  explore.nextEncounter = 10 + randomSource(options.random)() * 6;
  const started = startExploreCombat(state, options);
  return { ...started, started: started.ok };
}

export function getCombatView(state) {
  const combat = state.explore?.combat && ensureCombatCollections(state.explore.combat);
  if (!combat) return null;
  return {
    combat,
    enemy: EXPLORE_ENEMIES[combat.enemyId],
    intent: getEnemyIntent(state, combat),
    maxHp: getExploreMaxHp(state),
    cards: combat.hand.map((id, index) => ({ index, ...EXPLORE_CARDS[id], numbers: getCardNumbers(state, id), text: getCardText(state, id) }))
  };
}
