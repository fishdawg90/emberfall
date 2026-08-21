// Canonical gameplay data migrated from emberfall_v20_6_third_person_towns.html.
// Keep renderer and DOM concerns out of this module so the 3D world, mobile UI,
// and automated tests all consume the same rules.

export const METALS = Object.freeze([
  { id: 'iron', name: 'Iron', icon: '●', color: '#d59662', ore: 'Iron ore', bar: 'Iron bar', mine: 1, smelt: 1, oreV: 2, barV: 7, cost: 3, yield: [1, 3], place: 'Iron Mouth', desc: 'Upper mine · ordinary iron.', gate: null },
  { id: 'deepsteel', name: 'Deepsteel', icon: '◆', color: '#77a9cf', ore: 'Deepsteel ore', bar: 'Deepsteel bar', mine: 5, smelt: 4, oreV: 7, barV: 25, cost: 3, yield: [1, 2], place: 'Flooded Galleries', desc: 'Blue ore below the old waterline.', gate: { id: 'tunnelmauler', name: 'Tunnel Mauler', hp: 48, atk: 7, coin: 35 } },
  { id: 'starsilver', name: 'Star Silver', icon: '✦', color: '#b8a7ef', ore: 'Star-silver ore', bar: 'Star-silver bar', mine: 10, smelt: 8, oreV: 22, barV: 78, cost: 3, yield: [1, 2], place: 'Glass Veins', desc: 'Silver-violet seams behind black glass.', gate: { id: 'glasswarden', name: 'Glass Warden', hp: 88, atk: 11, coin: 110 } },
  { id: 'aetherite', name: 'Aetherite', icon: '✧', color: '#f0c85e', ore: 'Aetherite shard', bar: 'Aetherite ingot', mine: 16, smelt: 13, oreV: 70, barV: 255, cost: 4, yield: [1, 1], place: 'The Buried Sky', desc: 'Gold-blue crystal under impossible darkness.', gate: { id: 'abysssentinel', name: 'Abyss Sentinel', hp: 155, atk: 17, coin: 360 } }
]);

export const RECIPES = Object.freeze([
  { id: 'is', m: 'iron', type: 'weapon', name: 'Iron Longsword', bars: 3, req: 1, atk: 4, def: 0, val: 30 },
  { id: 'ih', m: 'iron', type: 'hands', name: 'Iron Gauntlets', bars: 6, req: 2, atk: 1, def: 2, val: 48 },
  { id: 'ihelm', m: 'iron', type: 'head', name: 'Iron Helm', bars: 10, req: 3, atk: 0, def: 4, val: 82 },
  { id: 'ib', m: 'iron', type: 'feet', name: 'Iron Boots', bars: 12, req: 4, atk: 0, def: 4, val: 96 },
  { id: 'il', m: 'iron', type: 'legs', name: 'Iron Greaves', bars: 18, req: 5, atk: 0, def: 6, val: 145 },
  { id: 'ia', m: 'iron', type: 'chest', name: 'Iron Brigandine', bars: 28, req: 6, atk: 0, def: 9, val: 230 },
  { id: 'ds', m: 'deepsteel', type: 'weapon', name: 'Deepsteel Blade', bars: 3, req: 4, atk: 8, def: 0, val: 105 },
  { id: 'dh', m: 'deepsteel', type: 'hands', name: 'Deepsteel Gauntlets', bars: 2, req: 5, atk: 2, def: 2, val: 78 },
  { id: 'dhelm', m: 'deepsteel', type: 'head', name: 'Deepsteel Helm', bars: 3, req: 6, atk: 0, def: 4, val: 105 },
  { id: 'db', m: 'deepsteel', type: 'feet', name: 'Deepsteel Boots', bars: 3, req: 7, atk: 0, def: 4, val: 118 },
  { id: 'dl', m: 'deepsteel', type: 'legs', name: 'Deepsteel Greaves', bars: 4, req: 8, atk: 0, def: 6, val: 150 },
  { id: 'da', m: 'deepsteel', type: 'chest', name: 'Deepsteel Harness', bars: 5, req: 9, atk: 0, def: 9, val: 205 },
  { id: 'ss', m: 'starsilver', type: 'weapon', name: 'Star-silver Edge', bars: 3, req: 8, atk: 15, def: 0, val: 330 },
  { id: 'sh', m: 'starsilver', type: 'hands', name: 'Star-silver Grips', bars: 2, req: 9, atk: 3, def: 3, val: 245 },
  { id: 'shelm', m: 'starsilver', type: 'head', name: 'Star-silver Helm', bars: 3, req: 10, atk: 0, def: 6, val: 335 },
  { id: 'sb', m: 'starsilver', type: 'feet', name: 'Star-silver Sabatons', bars: 3, req: 11, atk: 0, def: 6, val: 370 },
  { id: 'sl', m: 'starsilver', type: 'legs', name: 'Star-silver Greaves', bars: 4, req: 12, atk: 0, def: 9, val: 475 },
  { id: 'sa', m: 'starsilver', type: 'chest', name: 'Star-silver Plate', bars: 5, req: 13, atk: 0, def: 14, val: 640 },
  { id: 'as', m: 'aetherite', type: 'weapon', name: 'Aetherite Greatblade', bars: 3, req: 12, atk: 26, def: 0, val: 1120 },
  { id: 'ah', m: 'aetherite', type: 'hands', name: 'Aetherite Gauntlets', bars: 2, req: 13, atk: 5, def: 5, val: 840 },
  { id: 'ahelm', m: 'aetherite', type: 'head', name: 'Aetherite Crownhelm', bars: 3, req: 14, atk: 0, def: 10, val: 1140 },
  { id: 'ab', m: 'aetherite', type: 'feet', name: 'Aetherite Warboots', bars: 3, req: 15, atk: 0, def: 10, val: 1260 },
  { id: 'al', m: 'aetherite', type: 'legs', name: 'Aetherite Legguards', bars: 4, req: 16, atk: 0, def: 15, val: 1620 },
  { id: 'aa', m: 'aetherite', type: 'chest', name: 'Aetherite Wardplate', bars: 5, req: 17, atk: 0, def: 23, val: 2180 }
]);

export const ACTIVITIES = Object.freeze({
  mining: { name: 'Mining', icon: '⛏', seconds: 3.2, xp: 8 },
  smelting: { name: 'Smelting', icon: '♨', seconds: 4.4, xp: 11 },
  combat: { name: 'Combat Training', icon: '⚔', seconds: 4, xp: 9 }
});

export const UPGRADES = Object.freeze({
  speed: { name: 'Tempo', currency: 'coin', cap: 20, desc: 'Shorter cycle.', cost: rank => Math.round(18 * 1.72 ** rank) },
  yield: { name: 'Extraction', currency: 'coin', cap: 20, desc: 'More material.', cost: rank => Math.round(30 * 1.82 ** rank) },
  keen: { name: 'Keen Eye', currency: 'xp', cap: 15, desc: 'Faster shiny chances.', cost: rank => Math.round(36 * 1.66 ** rank) },
  crit: { name: 'Critical Sense', currency: 'xp', cap: 15, desc: 'More critical hits.', cost: rank => Math.round(44 * 1.72 ** rank) },
  power: { name: 'Critical Power', currency: 'coin', cap: 12, desc: 'Bigger critical value.', cost: rank => Math.round(65 * 1.94 ** rank) }
});

export const TOWN_PROJECTS = Object.freeze({
  forge: { name: 'Smithy', desc: 'Improves Fine and Masterwork quality chances.', base: 95, max: 3 },
  smelter: { name: 'Smelter', desc: 'Restored furnaces improve bar output.', base: 80, max: 3 },
  market: { name: 'Market', desc: 'A better market pays more for everything you sell.', base: 70, max: 3 },
  inn: { name: 'Wayfarer Inn', desc: 'Restored rooms increase expedition HP.', base: 60, max: 3 }
});

export const EQUIPMENT_SLOTS = Object.freeze([
  { id: 'weapon', name: 'Weapon', icon: '⚔' },
  { id: 'head', name: 'Helmet', icon: '◒' },
  { id: 'chest', name: 'Chest', icon: '♜' },
  { id: 'hands', name: 'Hands', icon: '✥' },
  { id: 'legs', name: 'Legs', icon: 'Ⅱ' },
  { id: 'feet', name: 'Boots', icon: '⌁' }
]);

export const EXPLORE_ENEMIES = Object.freeze({
  scavenger: { id: 'scavenger', name: 'Tunnel Scavenger', icon: '◖', hp: 24, guard: 5, dmg: 5, desc: 'Quick, brittle and eager to strike.' },
  stonehorn: { id: 'stonehorn', name: 'Stonehorn', icon: '◆', hp: 36, guard: 8, dmg: 7, desc: 'Slow armour with a punishing charge.' },
  crawler: { id: 'crawler', name: 'Glass Crawler', icon: '✣', hp: 29, guard: 6, dmg: 3, hits: 2, desc: 'A shard-backed thing that attacks twice.' },
  custodian: { id: 'custodian', name: 'Buried Custodian', icon: '✦', hp: 68, guard: 14, dmg: 9, desc: 'The old gatekeeper at the end of the route.' },
  tunnelmauler: { id: 'tunnelmauler', name: 'Tunnel Mauler', icon: '◆', hp: 48, guard: 10, dmg: 7, desc: 'A plated burrower blocking the flooded galleries.' },
  glasswarden: { id: 'glasswarden', name: 'Glass Warden', icon: '✦', hp: 88, guard: 15, dmg: 11, desc: 'A crystalline keeper reflecting every careless strike.' },
  abysssentinel: { id: 'abysssentinel', name: 'Abyss Sentinel', icon: '✧', hp: 155, guard: 22, dmg: 17, desc: 'The last watcher beneath an impossible sky.' }
});

export const EXPLORE_CARDS = Object.freeze({
  slash: { id: 'slash', name: 'Slash', icon: '╱', cost: 1, kind: 'attack', dmg: 5, text: 'Deal {dmg} damage.' },
  splitter: { id: 'splitter', name: 'Splitter', icon: '✣', cost: 1, kind: 'breaker', dmg: 2, brk: 3, text: 'Deal {dmg} damage · {brk} Break.' },
  guard: { id: 'guard', name: 'Guard', icon: '⬒', cost: 1, kind: 'guard', block: 5, text: 'Gain {block} Block.' },
  feint: { id: 'feint', name: 'Feint', icon: '↝', cost: 1, kind: 'utility', brk: 4, draw: 1, text: '{brk} Break · draw 1.' },
  heavy: { id: 'heavy', name: 'Heavy Strike', icon: '┃', cost: 2, kind: 'attack', dmg: 9, brk: 2, text: 'Deal {dmg} damage · {brk} Break.' },
  brace: { id: 'brace', name: 'Brace', icon: '▣', cost: 1, kind: 'guard', block: 8, text: 'Gain {block} Block.' },
  measured: { id: 'measured', name: 'Measured Cut', icon: '†', cost: 1, kind: 'attack', dmg: 6, brk: 1, text: 'Deal {dmg} damage · {brk} Break.' },
  sunder: { id: 'sunder', name: 'Sunder', icon: '✣', cost: 1, kind: 'breaker', dmg: 5, brk: 5, text: 'Deal {dmg} damage · {brk} Break.' },
  silvercut: { id: 'silvercut', name: 'Silver Arc', icon: '☾', cost: 1, kind: 'attack', dmg: 9, brk: 3, text: 'Deal {dmg} damage · {brk} Break.' },
  aetherbreak: { id: 'aetherbreak', name: 'Aether Break', icon: '✦', cost: 2, kind: 'breaker', dmg: 13, brk: 4, text: 'Deal {dmg} damage · {brk} Break.' },
  driving: { id: 'driving', name: 'Driving Blow', icon: '↯', cost: 2, kind: 'breaker', dmg: 7, brk: 4, text: 'Deal {dmg} damage · {brk} Break.' },
  sidestep: { id: 'sidestep', name: 'Sidestep', icon: '➶', cost: 1, kind: 'utility', evade: 1, draw: 1, text: 'Evade the next hit · draw 1.' },
  deflect: { id: 'deflect', name: 'Deflect', icon: '◈', cost: 1, kind: 'guard', block: 5, evade: 1, text: 'Gain {block} Block · Evade 1 hit.' },
  shatter: { id: 'shatter', name: 'Shatter', icon: '✹', cost: 2, kind: 'attack', dmg: 8, brokenBonus: 8, text: 'Deal {dmg} damage · +8 while Broken.' },
  shieldbash: { id: 'shieldbash', name: 'Shield Bash', icon: '⬢', cost: 1, kind: 'breaker', brk: 2, blockDamage: .75, text: '{brk} Break · deal 75% of your Block.' },
  hobble: { id: 'hobble', name: 'Hobble', icon: '⌁', cost: 1, kind: 'utility', dmg: 3, brk: 2, weak: 2, text: '{dmg} damage · {brk} Break · Weaken 2.' },
  rally: { id: 'rally', name: 'Hold Fast', icon: '♜', cost: 1, kind: 'guard', block: 7, retainBlock: .5, text: 'Gain {block} Block · retain half next turn.' },
  exploit: { id: 'exploit', name: 'Exploit', icon: '⚡', cost: 1, kind: 'attack', dmg: 6, brokenEnergy: 1, text: 'Deal {dmg} damage · refund 1 Energy if Broken.' },
  flurry: { id: 'flurry', name: 'Flurry', icon: '≋', cost: 1, kind: 'attack', dmg: 3, hits: 2, text: 'Deal {dmg} damage twice.' },
  focus: { id: 'focus', name: 'Battle Focus', icon: '◎', cost: 0, kind: 'utility', draw: 2, exhaust: true, text: 'Draw 2 · Exhaust this battle.' },
  bulwark: { id: 'bulwark', name: 'Bulwark', icon: '▰', cost: 2, kind: 'guard', block: 12, retainBlock: .5, text: 'Gain {block} Block · retain half next turn.' }
});

export const CAVE_REWARD_CARD_IDS = Object.freeze(['deflect', 'shatter', 'shieldbash', 'hobble', 'rally', 'exploit', 'flurry', 'focus', 'bulwark']);

export const STARTER_DECK = Object.freeze(['slash', 'slash', 'slash', 'splitter', 'splitter', 'guard', 'guard', 'guard', 'feint', 'heavy']);
