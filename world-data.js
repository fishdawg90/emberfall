// Renderer-independent world layout and progression helpers for the hosted 3D
// migration. Positions are expressed in Three.js ground-plane coordinates.

export const WORLD_SPACE_VERSION = 'hosted3d-v1';
export const WORLD_LIMIT = 330;
export const WORLD_POSITION_SAVE_INTERVAL = 36;

export const WORLD_LANDMARKS = Object.freeze([
  Object.freeze({
    id: 'town',
    name: 'Greyfen',
    subtitle: 'Restoration town',
    kind: 'town',
    area: 'town',
    icon: '⌂',
    x: 0,
    z: 8,
    entry: Object.freeze({ x: 0, z: 126 }),
    radius: 142,
    building: 'c'
  }),
  Object.freeze({
    id: 'frostmere',
    name: 'Frostmere',
    subtitle: 'Northern hold',
    kind: 'town',
    area: 'town',
    icon: '❄',
    x: -230,
    z: -210,
    entry: Object.freeze({ x: -211, z: -191 }),
    radius: 42,
    building: 'a'
  }),
  Object.freeze({
    id: 'sunspire',
    name: 'Sunspire',
    subtitle: 'Eastern citadel',
    kind: 'town',
    area: 'town',
    icon: '☀',
    x: 235,
    z: -20,
    entry: Object.freeze({ x: 214, z: -7 }),
    radius: 42,
    building: 'd'
  }),
  Object.freeze({
    id: 'tidewatch',
    name: 'Tidewatch',
    subtitle: 'Coastal refuge',
    kind: 'town',
    area: 'town',
    icon: '≋',
    x: 210,
    z: 270,
    entry: Object.freeze({ x: 192, z: 249 }),
    radius: 42,
    building: 'b'
  }),
  Object.freeze({
    id: 'forest',
    name: 'Whisperwood',
    subtitle: 'Wild region',
    kind: 'region',
    area: 'forest',
    icon: '♣',
    x: -225,
    z: 165,
    entry: Object.freeze({ x: -203, z: 153 }),
    radius: 62,
    building: 'garage'
  }),
  Object.freeze({
    id: 'cave',
    name: 'The Lower Ways',
    subtitle: 'Deepsteel route',
    kind: 'region',
    area: 'cave',
    icon: '◆',
    x: 225,
    z: 170,
    entry: Object.freeze({ x: 203, z: 158 }),
    radius: 62,
    building: 'garage'
  })
]);

export const WORLD_ROUTES = Object.freeze([
  Object.freeze({ id: 'greyfen-north', width: 7, points: Object.freeze([[10, -118], [-48, -153], [-124, -187], [-211, -191]]) }),
  Object.freeze({ id: 'greyfen-east', width: 6, points: Object.freeze([[72, 32], [132, 20], [178, 5], [214, -7]]) }),
  Object.freeze({ id: 'whisperwood-road', width: 6, points: Object.freeze([[0, 126], [-55, 146], [-128, 170], [-203, 153]]) }),
  Object.freeze({ id: 'lower-ways-road', width: 6, points: Object.freeze([[0, 126], [68, 142], [139, 181], [203, 158]]) }),
  Object.freeze({ id: 'tidewatch-road', width: 5.5, points: Object.freeze([[139, 181], [172, 215], [192, 249]]) })
]);

const LANDMARK_BY_ID = new Map(WORLD_LANDMARKS.map(landmark => [landmark.id, landmark]));

export function getWorldLandmark(id) {
  return LANDMARK_BY_ID.get(id) || null;
}

export function distanceToLandmark(position, landmark) {
  if (!position || !landmark) return Infinity;
  return Math.hypot(position.x - landmark.x, position.z - landmark.z);
}

export function getLandmarkAtPosition(position) {
  return WORLD_LANDMARKS
    .filter(landmark => distanceToLandmark(position, landmark) <= landmark.radius)
    .sort((a, b) => distanceToLandmark(position, a) - distanceToLandmark(position, b))[0] || null;
}

export function getAreaAtPosition(position) {
  const landmark = getLandmarkAtPosition(position);
  return {
    area: landmark?.area || 'world',
    townId: landmark?.kind === 'town' ? landmark.id : null,
    landmark
  };
}

export function isGuardianAvailable(state, landmarkOrId) {
  const landmark = typeof landmarkOrId === 'string' ? getWorldLandmark(landmarkOrId) : landmarkOrId;
  if (!landmark || landmark.kind !== 'region') return false;
  const wins = Number(state?.explore?.regionWins?.[landmark.area]) || 0;
  return wins >= 3 && !state?.explore?.claimed?.[landmark.area];
}

export function getFastTravelLandmarks(state) {
  return WORLD_LANDMARKS.filter(landmark => landmark.id === 'town'
    || (landmark.kind === 'region' && Boolean(state?.explore?.claimed?.[landmark.area])));
}

export function readHostedWorldPosition(explore, fallback = getWorldLandmark('town').entry) {
  const position = explore?.worldPos;
  if (explore?.worldSpace !== WORLD_SPACE_VERSION
    || !Array.isArray(position)
    || position.length < 2
    || !position.every(Number.isFinite)
    || Math.abs(position[0]) > WORLD_LIMIT
    || Math.abs(position[1]) > WORLD_LIMIT) {
    return { x: fallback.x, z: fallback.z, migrated: true };
  }
  return { x: position[0], z: position[1], migrated: false };
}

export function writeHostedWorldPosition(explore, position, areaInfo = getAreaAtPosition(position)) {
  explore.worldSpace = WORLD_SPACE_VERSION;
  explore.worldPos = [Number(position.x.toFixed(2)), Number(position.z.toFixed(2))];
  explore.area = areaInfo.area;
  if (areaInfo.townId) explore.townId = areaInfo.townId;
  else if (areaInfo.area !== 'town') delete explore.townId;
  return explore.worldPos;
}
