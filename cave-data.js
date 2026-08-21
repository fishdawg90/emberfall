// Deterministic Lower Ways generation. This module deliberately contains no
// DOM or Three.js code so generation, save migration, and routing stay testable.

export const CAVE_LAYOUT_VERSION = 'lower-ways-v1';
export const CAVE_WIDTH = 11;
export const CAVE_HEIGHT = 9;
export const CAVE_CELL_SIZE = 8;
export const CAVE_FLOOR_Y = -48;

const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: 0, dy: -1, bit: 1, opposite: 4 }),
  Object.freeze({ dx: 1, dy: 0, bit: 2, opposite: 8 }),
  Object.freeze({ dx: 0, dy: 1, bit: 4, opposite: 1 }),
  Object.freeze({ dx: -1, dy: 0, bit: 8, opposite: 2 })
]);

function seededRandom(seed) {
  let value = (Number(seed) || 1) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function indexOf(x, y, width) {
  return y * width + x;
}

function pointOf(index, width) {
  return { x: index % width, y: Math.floor(index / width) };
}

function inside(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function connectedNeighbours(passages, index, width, height) {
  const point = pointOf(index, width);
  return DIRECTIONS
    .filter(direction => passages[index] & direction.bit)
    .map(direction => ({
      index: indexOf(point.x + direction.dx, point.y + direction.dy, width),
      direction
    }))
    .filter(entry => entry.index >= 0 && entry.index < width * height);
}

function distancesFrom(passages, start, width, height) {
  const distances = new Array(width * height).fill(-1);
  const queue = [start];
  distances[start] = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const next of connectedNeighbours(passages, current, width, height)) {
      if (distances[next.index] >= 0) continue;
      distances[next.index] = distances[current] + 1;
      queue.push(next.index);
    }
  }
  return distances;
}

function openPassage(passages, from, direction, width) {
  const point = pointOf(from, width);
  const next = indexOf(point.x + direction.dx, point.y + direction.dy, width);
  passages[from] |= direction.bit;
  passages[next] |= direction.opposite;
  return next;
}

function chooseFurnishings(layout, random) {
  const reserved = new Set([layout.start, layout.goal]);
  const deadEnds = layout.cells
    .filter(cell => cell.degree === 1 && !reserved.has(cell.index) && cell.distance >= 5)
    .sort((a, b) => b.distance - a.distance);
  const heals = [];
  for (const cell of deadEnds) {
    // A spring is uncommon at any one dead-end, but a full maze usually gives
    // the player a fair chance of discovering one without making it guaranteed.
    if (heals.length < 2 && random() < 0.16) heals.push(cell.index);
  }
  const vistas = layout.cells
    .filter(cell => cell.degree >= 3 && cell.index !== layout.start && cell.index !== layout.goal)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 4)
    .map(cell => cell.index);
  return { heals, vistas };
}

export function createCaveLayout(seed, options = {}) {
  const width = Math.max(5, Math.floor(options.width || CAVE_WIDTH));
  const height = Math.max(5, Math.floor(options.height || CAVE_HEIGHT));
  const random = seededRandom(seed);
  const total = width * height;
  const passages = new Array(total).fill(0);
  const visited = new Uint8Array(total);
  const start = 0;
  const stack = [start];
  visited[start] = 1;

  // Iterative recursive-backtracker: fast, deterministic, and biased toward
  // memorable long corridors without risking a disconnected maze.
  while (stack.length) {
    const current = stack[stack.length - 1];
    const point = pointOf(current, width);
    const available = DIRECTIONS.filter(direction => {
      const x = point.x + direction.dx;
      const y = point.y + direction.dy;
      return inside(x, y, width, height) && !visited[indexOf(x, y, width)];
    });
    if (!available.length) {
      stack.pop();
      continue;
    }
    const direction = available[Math.floor(random() * available.length)];
    const next = openPassage(passages, current, direction, width);
    visited[next] = 1;
    stack.push(next);
  }

  let distances = distancesFrom(passages, start, width, height);
  let goal = distances.reduce((best, distance, index) => distance > distances[best] ? index : best, start);

  // Light braiding removes a few frustrating full backtracks while preserving
  // the route-reading character of the backtracker maze.
  const braidCandidates = passages
    .map((mask, index) => ({ index, degree: DIRECTIONS.filter(direction => mask & direction.bit).length }))
    .filter(cell => cell.degree === 1 && cell.index !== start && cell.index !== goal);
  let loops = 0;
  const maxLoops = Math.max(2, Math.round(total * 0.045));
  for (const cell of braidCandidates) {
    if (loops >= maxLoops || random() > 0.34) continue;
    const point = pointOf(cell.index, width);
    const closed = DIRECTIONS.filter(direction => {
      const x = point.x + direction.dx;
      const y = point.y + direction.dy;
      return inside(x, y, width, height) && !(passages[cell.index] & direction.bit);
    });
    if (!closed.length) continue;
    openPassage(passages, cell.index, closed[Math.floor(random() * closed.length)], width);
    loops += 1;
  }
  for (const cell of braidCandidates) {
    if (loops >= Math.min(2, maxLoops)) break;
    const point = pointOf(cell.index, width);
    const closed = DIRECTIONS.filter(direction => {
      const x = point.x + direction.dx;
      const y = point.y + direction.dy;
      return inside(x, y, width, height) && !(passages[cell.index] & direction.bit);
    });
    if (!closed.length) continue;
    openPassage(passages, cell.index, closed[Math.floor(random() * closed.length)], width);
    loops += 1;
  }

  distances = distancesFrom(passages, start, width, height);
  goal = distances.reduce((best, distance, index) => distance > distances[best] ? index : best, start);
  const cells = passages.map((mask, index) => ({
    index,
    ...pointOf(index, width),
    passages: mask,
    degree: DIRECTIONS.filter(direction => mask & direction.bit).length,
    distance: distances[index]
  }));
  const layout = {
    version: CAVE_LAYOUT_VERSION,
    seed: (Number(seed) || 1) >>> 0,
    width,
    height,
    start,
    goal,
    loops,
    longestPath: distances[goal],
    passages,
    cells
  };
  layout.furnishings = chooseFurnishings(layout, random);
  return layout;
}

export function getCaveCell(layout, cellOrIndex) {
  if (!layout) return null;
  if (Number.isInteger(cellOrIndex)) return layout.cells[cellOrIndex] || null;
  if (cellOrIndex && Number.isInteger(cellOrIndex.x) && Number.isInteger(cellOrIndex.y)) {
    if (!inside(cellOrIndex.x, cellOrIndex.y, layout.width, layout.height)) return null;
    return layout.cells[indexOf(cellOrIndex.x, cellOrIndex.y, layout.width)] || null;
  }
  return null;
}

export function caveCellToWorld(layout, cellOrIndex) {
  const cell = getCaveCell(layout, cellOrIndex) || layout.cells[layout.start];
  return {
    x: (cell.x - (layout.width - 1) / 2) * CAVE_CELL_SIZE,
    z: (cell.y - (layout.height - 1) / 2) * CAVE_CELL_SIZE,
    y: CAVE_FLOOR_Y
  };
}

export function caveWorldToCell(layout, position) {
  const x = Math.max(0, Math.min(layout.width - 1, Math.round((Number(position?.x) || 0) / CAVE_CELL_SIZE + (layout.width - 1) / 2)));
  const y = Math.max(0, Math.min(layout.height - 1, Math.round((Number(position?.z) || 0) / CAVE_CELL_SIZE + (layout.height - 1) / 2)));
  return layout.cells[indexOf(x, y, layout.width)];
}

export function getCavePath(layout, from, to) {
  const start = getCaveCell(layout, from)?.index ?? layout.start;
  const goal = getCaveCell(layout, to)?.index ?? layout.goal;
  const queue = [start];
  const cameFrom = new Map([[start, null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === goal) break;
    for (const next of connectedNeighbours(layout.passages, current, layout.width, layout.height)) {
      if (cameFrom.has(next.index)) continue;
      cameFrom.set(next.index, current);
      queue.push(next.index);
    }
  }
  if (!cameFrom.has(goal)) return [];
  const path = [];
  for (let current = goal; current != null; current = cameFrom.get(current)) path.push(current);
  return path.reverse();
}

export function getVisibleCaveCells(layout, discovered) {
  const known = new Set(Array.isArray(discovered) ? discovered : [layout.start]);
  for (const index of [...known]) {
    for (const neighbour of connectedNeighbours(layout.passages, index, layout.width, layout.height)) known.add(neighbour.index);
  }
  return [...known].filter(index => layout.cells[index]).sort((a, b) => a - b);
}

export function createFreshCaveRun(worldSeed = 1) {
  const seed = (((Number(worldSeed) || 1) * 2654435761) ^ 0xC4A9E) >>> 0;
  return {
    version: CAVE_LAYOUT_VERSION,
    seed,
    active: false,
    completed: false,
    position: null,
    cell: 0,
    discovered: [0],
    claimedHeals: [],
    bossStarted: false,
    returnWorldPos: null
  };
}

export function normalizeCaveRun(value, worldSeed = 1) {
  const base = createFreshCaveRun(worldSeed);
  const source = value && typeof value === 'object' ? value : {};
  const seed = Number.isFinite(source.seed) ? source.seed >>> 0 : base.seed;
  const layout = createCaveLayout(seed);
  const validCell = index => Number.isInteger(index) && index >= 0 && index < layout.cells.length;
  const uniqueCells = list => [...new Set((Array.isArray(list) ? list : []).filter(validCell))];
  const cell = validCell(source.cell) ? source.cell : layout.start;
  const position = Array.isArray(source.position) && source.position.length >= 2 && source.position.every(Number.isFinite)
    ? [source.position[0], source.position[1]]
    : null;
  const returnWorldPos = Array.isArray(source.returnWorldPos) && source.returnWorldPos.length >= 2 && source.returnWorldPos.every(Number.isFinite)
    ? [source.returnWorldPos[0], source.returnWorldPos[1]]
    : null;
  return {
    ...base,
    ...source,
    version: CAVE_LAYOUT_VERSION,
    seed,
    active: Boolean(source.active),
    completed: Boolean(source.completed),
    position,
    cell,
    discovered: uniqueCells([layout.start, ...uniqueCells(source.discovered), cell]),
    claimedHeals: uniqueCells(source.claimedHeals),
    bossStarted: Boolean(source.bossStarted),
    returnWorldPos
  };
}

export const CAVE_DIRECTIONS = DIRECTIONS;
