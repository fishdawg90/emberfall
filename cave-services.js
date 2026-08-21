import {
  CAVE_LAYOUT_VERSION,
  caveWorldToCell,
  createCaveLayout,
  getCaveCell,
  getVisibleCaveCells,
  normalizeCaveRun
} from './cave-data.js';
import { getExploreMaxHp } from './combat-services.js';

const layoutCache = new Map();

function layoutFor(run) {
  if (!layoutCache.has(run.seed)) layoutCache.set(run.seed, createCaveLayout(run.seed));
  return layoutCache.get(run.seed);
}

export function ensureCaveRun(state) {
  state.explore ||= {};
  if (state.explore.caveRun?.version !== CAVE_LAYOUT_VERSION || !Number.isFinite(state.explore.caveRun?.seed)) {
    state.explore.caveRun = normalizeCaveRun(state.explore.caveRun, state.explore.worldSeed);
  }
  return state.explore.caveRun;
}

export function getCaveRunView(state) {
  const run = ensureCaveRun(state);
  const layout = layoutFor(run);
  return {
    run,
    layout,
    cell: getCaveCell(layout, run.cell),
    visible: getVisibleCaveCells(layout, run.discovered),
    progress: Math.round(run.discovered.length / layout.cells.length * 100),
    atGoal: run.cell === layout.goal
  };
}

export function enterLowerWays(state, returnWorldPos) {
  const run = ensureCaveRun(state);
  const layout = layoutFor(run);
  run.active = true;
  run.returnWorldPos = Array.isArray(returnWorldPos) ? [...returnWorldPos] : run.returnWorldPos;
  run.cell = Number.isInteger(run.cell) ? run.cell : layout.start;
  run.discovered = [...new Set([layout.start, ...run.discovered, run.cell])];
  run.bossStarted = false;
  state.explore.area = 'cave';
  delete state.explore.townId;
  state.explore.maxHp = getExploreMaxHp(state);
  if (!state.explore.hp || state.explore.hp > state.explore.maxHp) state.explore.hp = state.explore.maxHp;
  return { ok: true, run, layout, resumed: run.cell !== layout.start };
}

export function leaveLowerWays(state) {
  const run = ensureCaveRun(state);
  if (!run.active) return { ok: false, code: 'not-in-cave', message: 'You are not in the Lower Ways.' };
  run.active = false;
  run.bossStarted = false;
  run.runCards = [];
  run.pendingDraft = null;
  state.explore.area = 'world';
  return { ok: true, returnWorldPos: run.returnWorldPos ? [...run.returnWorldPos] : null };
}

export function updateCavePosition(state, position) {
  const run = ensureCaveRun(state);
  const layout = layoutFor(run);
  const cell = caveWorldToCell(layout, position);
  const discoveredBefore = new Set(run.discovered);
  run.cell = cell.index;
  run.position = [Number(position.x.toFixed(2)), Number(position.z.toFixed(2))];
  run.discovered = [...new Set([...run.discovered, cell.index])].sort((a, b) => a - b);
  const cache = useNearbyCaveCoinCache(state, position);
  if (cache.claimed) state.explore.lastCaveFind = { type: 'coins', amount: cache.coins, cell: cache.cell };
  return {
    ok: true,
    run,
    layout,
    cell,
    discovered: !discoveredBefore.has(cell.index),
    cache: cache.claimed ? cache : null,
    atGoal: cell.index === layout.goal
  };
}

export function useNearbyCaveHealing(state, position) {
  const run = ensureCaveRun(state);
  const layout = layoutFor(run);
  const cell = caveWorldToCell(layout, position);
  if (!layout.furnishings.heals.includes(cell.index) || run.claimedHeals.includes(cell.index)) {
    return { ok: true, healed: false, cell: cell.index };
  }
  const maxHp = getExploreMaxHp(state);
  state.explore.maxHp = maxHp;
  if (!state.explore.hp) state.explore.hp = maxHp;
  if (state.explore.hp >= maxHp) return { ok: true, healed: false, available: true, cell: cell.index };
  const before = state.explore.hp;
  const amount = Math.max(9, Math.ceil(maxHp * 0.3));
  state.explore.hp = Math.min(maxHp, state.explore.hp + amount);
  run.claimedHeals.push(cell.index);
  return { ok: true, healed: true, amount: state.explore.hp - before, hp: state.explore.hp, maxHp, cell: cell.index };
}

export function useNearbyCaveCoinCache(state, position) {
  const run = ensureCaveRun(state);
  const layout = layoutFor(run);
  const cell = caveWorldToCell(layout, position);
  if (!layout.furnishings.coins.includes(cell.index) || run.claimedCoins.includes(cell.index)) {
    return { ok: true, claimed: false, cell: cell.index };
  }
  const coins = 9 + ((run.seed ^ (cell.index * 31)) >>> 0) % 9;
  state.coins += coins;
  state.explore.haul.coins += coins;
  run.claimedCoins.push(cell.index);
  return { ok: true, claimed: true, coins, cell: cell.index };
}

export function markCaveBossStarted(state) {
  const view = getCaveRunView(state);
  if (view.run.completed || state.explore?.claimed?.cave) return { ok: false, code: 'boss-complete' };
  if (!view.atGoal) return { ok: false, code: 'boss-distant' };
  if (view.run.bossStarted) return { ok: false, code: 'boss-started' };
  view.run.bossStarted = true;
  return { ok: true, ...view };
}

export function completeLowerWays(state) {
  const run = ensureCaveRun(state);
  run.completed = true;
  run.bossStarted = false;
  return run;
}

export function resetCaveBossAfterCombat(state) {
  const run = ensureCaveRun(state);
  run.bossStarted = false;
  if (state.explore?.claimed?.cave) run.completed = true;
  return run;
}
