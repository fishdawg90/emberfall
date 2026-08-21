import { METALS, TOWN_PROJECTS } from './game-catalog.js';
import { addHeroXp, getTownCost } from './gameplay-services.js';

export const TOWN_WELCOME_CONTRACTS = Object.freeze({
  frostmere: Object.freeze({ name: 'Northern survey', coins: 30, xp: 10, text: 'Frostmere pays Greyfen for reopening the northern road.' }),
  sunspire: Object.freeze({ name: 'Eastern charter', coins: 45, xp: 14, text: 'Sunspire signs a new trade charter with Greyfen.' }),
  tidewatch: Object.freeze({ name: 'Coastal bounty', coins: 60, xp: 18, text: 'Tidewatch rewards the first safe overland delivery.' })
});

export const MINE_GATE_LOCATIONS = Object.freeze({
  1: Object.freeze({ landmarkId: 'cave', name: 'The Lower Ways' }),
  2: Object.freeze({ landmarkId: 'sunspire', name: 'Sunspire Glass Mine' }),
  3: Object.freeze({ landmarkId: 'tidewatch', name: 'Tidewatch Buried Mine' })
});

const GREYFEN_TASKS = Object.freeze([
  Object.freeze({ id: 'mine', icon: '⛏', title: 'Find the town mine' }),
  Object.freeze({ id: 'smelter', icon: '♨', title: 'Find the smelter' }),
  Object.freeze({ id: 'forge', icon: '⚒', title: 'Find the smithy' }),
  Object.freeze({ id: 'market', icon: '◇', title: 'Find the market' })
]);

function townVisits(state) {
  return state.journey?.towns || {};
}

function objective(id, chapter, icon, title, detail, action = {}) {
  return { id, chapter, icon, title, detail, button: action.button || 'GO', ...action };
}

export function getGreyfenTasks(state) {
  const services = state.journey?.services || {};
  const tasks = GREYFEN_TASKS.map(task => ({ ...task, complete: Boolean(services[task.id]), serviceId: task.id }));
  const tradeCoins = Math.max(0, Number(state.journey?.tradeCoins) || 0);
  tasks.push({ id: 'trade', icon: '¢', title: 'Earn 15 coin through trade', complete: tradeCoins >= 15, progress: `${Math.min(15, tradeCoins)}/15` });
  return tasks;
}

export function recordServiceVisit(state, serviceId) {
  if (!GREYFEN_TASKS.some(task => task.id === serviceId)) return { ok: true, discovered: false, serviceId };
  state.journey ||= { towns: { town: true } };
  state.journey.services ||= {};
  const discovered = !state.journey.services[serviceId];
  state.journey.services[serviceId] = true;
  return { ok: true, discovered, serviceId };
}

export function recordTradeCoins(state, coins) {
  const amount = Math.max(0, Math.floor(Number(coins) || 0));
  state.journey ||= { towns: { town: true } };
  state.journey.tradeCoins = (Number(state.journey.tradeCoins) || 0) + amount;
  return { ok: true, amount, total: state.journey.tradeCoins, complete: state.journey.tradeCoins >= 15 };
}

export function getMineGateLocation(depth) {
  return MINE_GATE_LOCATIONS[Number(depth)] || null;
}

export function canChallengeMineGate(state, depth) {
  const location = getMineGateLocation(depth);
  if (!location) return false;
  if (Number(depth) === 1) return state.explore?.area === 'cave';
  return state.explore?.area === 'town' && state.explore?.townId === location.landmarkId && Boolean(state.journey?.towns?.[location.landmarkId]);
}

export function recordTownArrival(state, townId) {
  const contract = TOWN_WELCOME_CONTRACTS[townId];
  if (!contract) return { ok: true, discovered: false, townId, coins: 0, xp: 0 };
  state.journey ||= { introSeen: false, towns: { town: true } };
  state.journey.towns ||= { town: true };
  if (state.journey.towns[townId]) return { ok: true, discovered: false, townId, coins: 0, xp: 0 };
  state.journey.towns[townId] = true;
  state.coins += contract.coins;
  const heroProgress = addHeroXp(state, contract.xp);
  return { ok: true, discovered: true, townId, ...contract, heroProgress };
}

export function getJourneyObjective(state) {
  const visits = townVisits(state);
  const equippedWeapon = state.gear?.find(item => item.id === state.eq?.weapon);
  const forgedWeapon = state.gear?.find(item => item.type === 'weapon');
  const ironOre = Number(state.inv?.ironOre) || 0;
  const ironBars = Number(state.inv?.ironBar) || 0;

  if (!state.journey?.services?.mine) {
    return objective('find-mine', 'LEARN GREYFEN', '⛏', 'Find Greyfen’s town mine', 'Follow the marker through the safe town streets.', { serviceId: 'mine', worldAction: 'service', button: 'ROUTE' });
  }

  if (!forgedWeapon) {
    const oreNeeded = Math.max(0, (3 - ironBars) * 3);
    if (ironOre < oreNeeded) {
      const effective = Math.min(9, ironBars * 3 + ironOre);
      return objective('first-ore', 'REKINDLE GREYFEN', '⛏', 'Mine iron for your first weapon', `${effective}/9 ore-equivalent · work continues while you explore`, { tab: 'work', activity: 'mining', button: 'MINE' });
    }
    if (!state.journey?.services?.smelter) return objective('find-smelter', 'LEARN GREYFEN', '♨', 'Find Greyfen’s smelter', 'The furnace stands close to the town mine.', { serviceId: 'smelter', worldAction: 'service', button: 'ROUTE' });
    if (ironBars < 3) return objective('first-bars', 'REKINDLE GREYFEN', '♨', 'Smelt 3 iron bars', `${ironBars}/3 bars · each bar uses 3 iron ore`, { tab: 'work', activity: 'smelting', button: 'SMELT' });
    if (!state.journey?.services?.forge) return objective('find-forge', 'LEARN GREYFEN', '⚒', 'Find Greyfen’s smithy', 'Take the finished bars to the marked smithy.', { serviceId: 'forge', worldAction: 'service', button: 'ROUTE' });
    return objective('first-forge', 'REKINDLE GREYFEN', '⚒', 'Forge an Iron Longsword', 'Your weapon improves attack damage and changes your combat deck.', { tab: 'forge', metalId: 'iron', button: 'FORGE' });
  }

  if (!state.journey?.services?.market) return objective('find-market', 'LEARN GREYFEN', '◇', 'Find Greyfen’s market', 'Learn where to sell surplus ore and old equipment.', { serviceId: 'market', worldAction: 'service', button: 'ROUTE' });
  const tradeCoins = Number(state.journey?.tradeCoins) || 0;
  if (tradeCoins < 15) return objective('first-trade', 'LEARN GREYFEN', '¢', 'Earn 15 coin at the market', `${tradeCoins}/15 coin earned by selling · mine surplus ore if needed`, { tab: 'market', button: 'TRADE' });
  if (!equippedWeapon) return objective('first-equip', 'REKINDLE GREYFEN', '⚔', 'Equip your forged weapon', 'Weapons improve attacks and add a stronger card to your deck.', { tab: 'gear', button: 'EQUIP' });

  if (!visits.frostmere) {
    return objective('visit-frostmere', 'OPEN THE ROADS', '❄', 'Carry Greyfen’s survey to Frostmere', 'Follow the northern road. Battles on the way earn coin and Hero XP.', { landmarkId: 'frostmere', worldAction: 'route', button: 'ROUTE' });
  }

  if ((state.town?.inn || 0) < 1) {
    const cost = getTownCost(state, 'inn');
    if (state.coins < cost) {
      return objective('fund-inn', 'RESTORE GREYFEN', '◇', 'Fund the Wayfarer Inn', `${state.coins}/${cost} coin · sell spare materials or win road battles`, { tab: 'market', button: 'TRADE' });
    }
    return objective('restore-inn', 'RESTORE GREYFEN', '⌂', 'Restore the Wayfarer Inn', 'The restored inn permanently raises expedition health.', { tab: 'town', button: 'RESTORE' });
  }

  const caveWins = Number(state.explore?.regionWins?.cave) || 0;
  if (!state.explore?.claimed?.cave) {
    if (caveWins < 3) {
      const inside = state.explore?.area === 'cave';
      return objective('patrol-cave', 'SECURE DEEPSTEEL', '◆', inside ? 'Patrol the Lower Ways' : 'Reach the Lower Ways', `${caveWins}/3 patrols cleared · three victories reveal its guardian`, { landmarkId: 'cave', worldAction: inside ? 'patrol' : 'route', button: inside ? 'PATROL' : 'ROUTE' });
    }
    return objective('guardian-cave', 'SECURE DEEPSTEEL', '☧', 'Challenge the Lower Ways guardian', 'Defeat it to open Deepsteel mining and unlock fast travel.', { landmarkId: 'cave', worldAction: 'guardian', button: 'CHALLENGE' });
  }

  const forestWins = Number(state.explore?.regionWins?.forest) || 0;
  if (!state.explore?.claimed?.forest) {
    if (forestWins < 3) {
      const inside = state.explore?.area === 'forest';
      return objective('patrol-forest', 'TAME THE WILD ROAD', '♣', inside ? 'Patrol Whisperwood' : 'Reach Whisperwood', `${forestWins}/3 patrols cleared · gear and town upgrades make each run safer`, { landmarkId: 'forest', worldAction: inside ? 'patrol' : 'route', button: inside ? 'PATROL' : 'ROUTE' });
    }
    return objective('guardian-forest', 'TAME THE WILD ROAD', '☧', 'Challenge the Whisperwood guardian', 'Victory secures the forest route and unlocks fast travel.', { landmarkId: 'forest', worldAction: 'guardian', button: 'CHALLENGE' });
  }

  if (!visits.sunspire) {
    return objective('visit-sunspire', 'REUNITE EMBERFALL', '☀', 'Take the eastern charter to Sunspire', 'A first arrival earns a trade reward for Greyfen’s restoration.', { landmarkId: 'sunspire', worldAction: 'route', button: 'ROUTE' });
  }
  if ((Number(state.open) || 0) < 2) {
    const metal = METALS[2];
    const miningLevel = Number(state.skills?.mining?.l) || 1;
    const atGate = canChallengeMineGate(state, 2);
    if (!atGate) return objective('reach-starsilver-mine', 'DESCEND DEEPER', metal.icon, 'Find Sunspire’s Glass Veins', 'Return to Sunspire and follow its mine marker.', { landmarkId: 'sunspire', worldAction: 'route', button: 'ROUTE' });
    if (miningLevel < metal.mine) return objective('train-starsilver', 'DESCEND DEEPER', metal.icon, `Raise Mining to level ${metal.mine}`, `Mining Lv ${miningLevel}/${metal.mine} · train before challenging the Glass Warden`, { tab: 'work', activity: 'mining', button: 'TRAIN' });
    return objective('gate-starsilver', 'DESCEND DEEPER', metal.icon, 'Challenge the Glass Warden', 'Victory opens Star-silver mining beneath Sunspire.', { gateDepth: 2, button: 'CHALLENGE' });
  }
  if (!visits.tidewatch) {
    return objective('visit-tidewatch', 'REUNITE EMBERFALL', '≋', 'Complete the road to Tidewatch', 'Reach the coast to collect its delivery bounty and Hero XP.', { landmarkId: 'tidewatch', worldAction: 'route', button: 'ROUTE' });
  }

  if ((Number(state.open) || 0) < 3) {
    const nextDepth = 3;
    const metal = METALS[nextDepth];
    const miningLevel = Number(state.skills?.mining?.l) || 1;
    const atGate = canChallengeMineGate(state, nextDepth);
    if (!atGate) return objective('reach-aetherite-mine', 'DESCEND DEEPER', metal.icon, 'Find Tidewatch’s Buried Mine', 'Return to Tidewatch and follow its mine marker.', { landmarkId: 'tidewatch', worldAction: 'route', button: 'ROUTE' });
    if (miningLevel < metal.mine) {
      return objective(`train-${metal.id}`, 'DESCEND DEEPER', metal.icon, `Raise Mining to level ${metal.mine}`, `Mining Lv ${miningLevel}/${metal.mine} · the ${metal.gate.name} guards ${metal.place}`, { tab: 'work', activity: 'mining', button: 'TRAIN' });
    }
    return objective(`gate-${metal.id}`, 'DESCEND DEEPER', metal.icon, `Defeat the ${metal.gate.name}`, `Open ${metal.place} and its ${metal.name} recipes.`, { gateDepth: nextDepth, button: 'CHALLENGE' });
  }

  const projectId = Object.keys(TOWN_PROJECTS).find(id => (Number(state.town?.[id]) || 0) < TOWN_PROJECTS[id].max);
  if (projectId) {
    const project = TOWN_PROJECTS[projectId];
    const cost = getTownCost(state, projectId);
    if (state.coins < cost) return objective(`fund-${projectId}`, 'RESTORE GREYFEN', '◇', `Fund ${project.name} Lv ${(state.town?.[projectId] || 0) + 1}`, `${state.coins}/${cost} coin · trade materials and clear patrols`, { tab: 'market', button: 'TRADE' });
    return objective(`restore-${projectId}`, 'RESTORE GREYFEN', '⌂', `Restore ${project.name}`, `${cost} coin · each level strengthens another part of the game`, { tab: 'town', button: 'RESTORE' });
  }

  return objective('emberfall-mastered', 'EMBERFALL RESTORED', '✦', 'Forge your strongest loadout', 'All roads and depths are open. Hunt masterworks and improve every skill.', { tab: 'forge', button: 'FORGE' });
}
