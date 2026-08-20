import { METALS, TOWN_PROJECTS } from './game-catalog.js';
import { addHeroXp, getTownCost } from './gameplay-services.js';

export const TOWN_WELCOME_CONTRACTS = Object.freeze({
  frostmere: Object.freeze({ name: 'Northern survey', coins: 30, xp: 10, text: 'Frostmere pays Greyfen for reopening the northern road.' }),
  sunspire: Object.freeze({ name: 'Eastern charter', coins: 45, xp: 14, text: 'Sunspire signs a new trade charter with Greyfen.' }),
  tidewatch: Object.freeze({ name: 'Coastal bounty', coins: 60, xp: 18, text: 'Tidewatch rewards the first safe overland delivery.' })
});

function townVisits(state) {
  return state.journey?.towns || {};
}

function objective(id, chapter, icon, title, detail, action = {}) {
  return { id, chapter, icon, title, detail, button: action.button || 'GO', ...action };
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

  if (!equippedWeapon) {
    if (!forgedWeapon) {
      const oreNeeded = Math.max(0, (3 - ironBars) * 3);
      if (ironOre < oreNeeded) {
        const effective = Math.min(9, ironBars * 3 + ironOre);
        return objective('first-ore', 'REKINDLE GREYFEN', '⛏', 'Mine iron for your first weapon', `${effective}/9 ore-equivalent · work continues while you explore`, { tab: 'work', activity: 'mining', button: 'MINE' });
      }
      if (ironBars < 3) return objective('first-bars', 'REKINDLE GREYFEN', '♨', 'Smelt 3 iron bars', `${ironBars}/3 bars · each bar uses 3 iron ore`, { tab: 'work', activity: 'smelting', button: 'SMELT' });
      return objective('first-forge', 'REKINDLE GREYFEN', '⚒', 'Forge an Iron Longsword', 'Your weapon improves attack damage and changes your combat deck.', { tab: 'forge', metalId: 'iron', button: 'FORGE' });
    }
    return objective('first-equip', 'REKINDLE GREYFEN', '⚔', 'Equip your forged weapon', 'Weapons improve attacks and add a stronger card to your deck.', { tab: 'gear', button: 'EQUIP' });
  }

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
  if (!visits.tidewatch) {
    return objective('visit-tidewatch', 'REUNITE EMBERFALL', '≋', 'Complete the road to Tidewatch', 'Reach the coast to collect its delivery bounty and Hero XP.', { landmarkId: 'tidewatch', worldAction: 'route', button: 'ROUTE' });
  }

  const nextDepth = Math.min(METALS.length - 1, (Number(state.open) || 0) + 1);
  if ((Number(state.open) || 0) < METALS.length - 1) {
    const metal = METALS[nextDepth];
    const miningLevel = Number(state.skills?.mining?.l) || 1;
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
