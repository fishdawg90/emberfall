import {
  CAVE_CELL_SIZE,
  CAVE_DIRECTIONS,
  CAVE_FLOOR_Y,
  caveCellToWorld,
  caveWorldToCell,
  getCavePath,
  getVisibleCaveCells
} from './cave-data.js';

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

function placeInstance(mesh, index, dummy, position, rotation, scale) {
  dummy.position.set(position.x, position.y, position.z);
  dummy.rotation.set(rotation?.x || 0, rotation?.y || 0, rotation?.z || 0);
  dummy.scale.set(scale?.x || 1, scale?.y || 1, scale?.z || 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function makeInstanced(THREE, geometry, material, count, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.name = name;
  mesh.count = count;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function createMarker(THREE, colour, icon = 'crystal') {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.25, roughness: .48 });
  if (icon === 'spring') {
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.44, .18, 18), new THREE.MeshStandardMaterial({ color: 0x294f47, emissive: 0x2d9c71, emissiveIntensity: .55, roughness: .24 }));
    pool.position.y = .11;
    group.add(pool);
    for (let index = 0; index < 7; index += 1) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.18 + index % 2 * .05, 8, 5), material);
      const angle = index / 7 * Math.PI * 2;
      cap.scale.y = .52;
      cap.position.set(Math.cos(angle) * (1.28 + index % 2 * .28), .22 + index % 3 * .12, Math.sin(angle) * (1.28 + index % 2 * .28));
      group.add(cap);
    }
  } else {
    for (let index = 0; index < 5; index += 1) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(.23 + index * .035, 1.25 + index * .28, 5), material);
      const angle = index / 5 * Math.PI * 2;
      shard.position.set(Math.cos(angle) * .48, shard.geometry.parameters.height / 2, Math.sin(angle) * .48);
      shard.rotation.z = (index - 2) * .08;
      group.add(shard);
    }
  }
  return group;
}

function addAuthoredRockLandmarks({ THREE, group, layout, rockAsset, mobile }) {
  if (!rockAsset || group.userData.authoredRocks) return 0;
  group.userData.authoredRocks = true;
  const cells = [...layout.furnishings.vistas, layout.goal];
  const count = mobile ? Math.min(4, cells.length) : cells.length;
  for (const [index, cellIndex] of cells.slice(0, count).entries()) {
    const rock = rockAsset.clone(true);
    const position = caveCellToWorld(layout, cellIndex);
    rock.position.set(position.x + (index % 2 ? 2.4 : -2.4), CAVE_FLOOR_Y + .02, position.z + (index % 3 - 1) * 1.5);
    rock.scale.multiplyScalar(1.2 + index * .16);
    rock.rotation.y = index * 1.37;
    rock.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = true;
      if (child.material) {
        child.material = child.material.clone();
        child.material.color?.multiplyScalar(.56);
        child.material.roughness = 1;
      }
    });
    group.add(rock);
  }
  return count;
}

export function createLowerWaysVisuals({ THREE, scene, layout, mobile = false, rockAsset = null }) {
  const group = new THREE.Group();
  group.name = 'lower-ways-procedural-expedition';
  group.visible = false;
  scene.add(group);
  const random = seededRandom(layout.seed ^ 0xBADC0DE);
  const dummy = new THREE.Object3D();
  const wallSegments = [];
  for (const cell of layout.cells) {
    const position = caveCellToWorld(layout, cell.index);
    for (const direction of CAVE_DIRECTIONS) {
      if (cell.passages & direction.bit) continue;
      // North/west own their shared walls; east/south are retained only at the boundary.
      if (direction.bit === 2 && cell.x < layout.width - 1) continue;
      if (direction.bit === 4 && cell.y < layout.height - 1) continue;
      wallSegments.push({ cell, direction, position });
    }
  }

  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x3b4548, roughness: 1, metalness: 0 });
  const floor = makeInstanced(THREE, new THREE.BoxGeometry(CAVE_CELL_SIZE - .12, .26, CAVE_CELL_SIZE - .12), floorMaterial, layout.cells.length, 'lower-ways-floor');
  for (const [index, cell] of layout.cells.entries()) {
    const position = caveCellToWorld(layout, cell.index);
    placeInstance(floor, index, dummy, { x: position.x, y: CAVE_FLOOR_Y - .13, z: position.z }, { y: random() * .025 }, { y: .86 + random() * .22 });
  }
  floor.instanceMatrix.needsUpdate = true;
  group.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5457, roughness: .98, vertexColors: true });
  const wall = makeInstanced(THREE, new THREE.BoxGeometry(CAVE_CELL_SIZE + .22, 5.5, .72, 2, 2, 1), wallMaterial, wallSegments.length, 'lower-ways-rock-walls');
  for (const [index, segment] of wallSegments.entries()) {
    const horizontal = segment.direction.bit === 1 || segment.direction.bit === 4;
    const x = segment.position.x + segment.direction.dx * CAVE_CELL_SIZE / 2;
    const z = segment.position.z + segment.direction.dy * CAVE_CELL_SIZE / 2;
    placeInstance(wall, index, dummy, { x, y: CAVE_FLOOR_Y + 2.55, z }, { y: horizontal ? 0 : Math.PI / 2, z: (random() - .5) * .025 }, { x: .96 + random() * .08, y: .9 + random() * .18, z: .92 + random() * .15 });
    const shade = .72 + random() * .24;
    wall.setColorAt(index, new THREE.Color(shade * .48, shade * .53, shade * .55));
  }
  wall.instanceMatrix.needsUpdate = true;
  if (wall.instanceColor) wall.instanceColor.needsUpdate = true;
  group.add(wall);

  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3335, roughness: 1, side: THREE.DoubleSide });
  const ceiling = makeInstanced(THREE, new THREE.BoxGeometry(CAVE_CELL_SIZE, .38, CAVE_CELL_SIZE), ceilingMaterial, layout.cells.length, 'lower-ways-ceiling');
  for (const [index, cell] of layout.cells.entries()) {
    const position = caveCellToWorld(layout, cell.index);
    placeInstance(ceiling, index, dummy, { x: position.x, y: CAVE_FLOOR_Y + 5.65 + (random() - .5) * .3, z: position.z }, { y: random() * .04 }, { y: .8 + random() * .35 });
  }
  ceiling.instanceMatrix.needsUpdate = true;
  group.add(ceiling);

  const rubbleCount = mobile ? 120 : 190;
  const rubble = makeInstanced(THREE, new THREE.DodecahedronGeometry(.55, 0), new THREE.MeshStandardMaterial({ color: 0x465054, roughness: 1 }), rubbleCount, 'lower-ways-instanced-rubble');
  for (let index = 0; index < rubbleCount; index += 1) {
    const cell = layout.cells[Math.floor(random() * layout.cells.length)];
    const position = caveCellToWorld(layout, cell.index);
    const side = random() > .5 ? 1 : -1;
    const alongX = random() > .5;
    const edge = CAVE_CELL_SIZE * (.34 + random() * .08) * side;
    const x = position.x + (alongX ? edge : (random() - .5) * CAVE_CELL_SIZE * .8);
    const z = position.z + (alongX ? (random() - .5) * CAVE_CELL_SIZE * .8 : edge);
    const size = .35 + random() * .82;
    placeInstance(rubble, index, dummy, { x, y: CAVE_FLOOR_Y + size * .35, z }, { x: random() * 2, y: random() * 6.28, z: random() }, { x: size * (1 + random()), y: size * .7, z: size });
  }
  rubble.instanceMatrix.needsUpdate = true;
  group.add(rubble);

  const crystalCount = mobile ? 26 : 42;
  const crystals = makeInstanced(THREE, new THREE.ConeGeometry(.22, 1.25, 5), new THREE.MeshStandardMaterial({ color: 0x5c9eae, emissive: 0x246679, emissiveIntensity: .9, roughness: .45 }), crystalCount, 'lower-ways-crystals');
  for (let index = 0; index < crystalCount; index += 1) {
    const cell = layout.cells[Math.floor(random() * layout.cells.length)];
    const position = caveCellToWorld(layout, cell.index);
    const height = .65 + random() * 1.1;
    placeInstance(crystals, index, dummy, { x: position.x + (random() - .5) * 5.5, y: CAVE_FLOOR_Y + height / 2, z: position.z + (random() - .5) * 5.5 }, { z: (random() - .5) * .28, y: random() * 6.28 }, { x: .7 + random() * .55, y: height / 1.25, z: .7 + random() * .55 });
  }
  crystals.instanceMatrix.needsUpdate = true;
  group.add(crystals);

  const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2b20, roughness: 1 });
  const beamCells = [...layout.furnishings.vistas, layout.cells[Math.floor(layout.cells.length * .38)]?.index].filter(Number.isInteger);
  const beams = makeInstanced(THREE, new THREE.BoxGeometry(.36, 4.8, .36), beamMaterial, beamCells.length * 2, 'lower-ways-mine-supports');
  let beamIndex = 0;
  for (const cellIndex of beamCells) {
    const position = caveCellToWorld(layout, cellIndex);
    for (const side of [-1, 1]) placeInstance(beams, beamIndex++, dummy, { x: position.x + side * 2.7, y: CAVE_FLOOR_Y + 2.4, z: position.z }, { z: side * .04 }, null);
  }
  beams.instanceMatrix.needsUpdate = true;
  group.add(beams);

  const entryPosition = caveCellToWorld(layout, layout.start);
  const entryMarker = new THREE.Group();
  entryMarker.name = 'lower-ways-entrance-marker';
  const ladderMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.18, 4.5, .18), ladderMaterial);
    rail.position.set(entryPosition.x + side * .55, CAVE_FLOOR_Y + 2.25, entryPosition.z + 2.9);
    entryMarker.add(rail);
  }
  for (let index = 0; index < 7; index += 1) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(1.25, .12, .16), ladderMaterial);
    rung.position.set(entryPosition.x, CAVE_FLOOR_Y + .5 + index * .55, entryPosition.z + 2.9);
    entryMarker.add(rung);
  }
  group.add(entryMarker);

  const goalPosition = caveCellToWorld(layout, layout.goal);
  const goalPath = getCavePath(layout, layout.start, layout.goal);
  const approachPosition = caveCellToWorld(layout, goalPath.at(-2) ?? layout.start);
  const approachLength = Math.hypot(goalPosition.x - approachPosition.x, goalPosition.z - approachPosition.z) || 1;
  const goalDx = (goalPosition.x - approachPosition.x) / approachLength;
  const goalDz = (goalPosition.z - approachPosition.z) / approachLength;
  const goalFacing = Math.atan2(goalDx, goalDz);
  const guardian = new THREE.Group();
  guardian.name = 'lower-ways-guardian-chamber';
  const seal = new THREE.Mesh(new THREE.TorusGeometry(2.15, .24, 8, 28), new THREE.MeshStandardMaterial({ color: 0xc67842, emissive: 0x8e351c, emissiveIntensity: 1.1, roughness: .42 }));
  seal.position.set(goalPosition.x + goalDx * 2.55, CAVE_FLOOR_Y + 2.45, goalPosition.z + goalDz * 2.55);
  seal.rotation.y = goalFacing;
  guardian.add(seal);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(5.4, 4.4, .42), new THREE.MeshStandardMaterial({ color: 0x342f2c, metalness: .6, roughness: .58, wireframe: true }));
  gate.position.set(goalPosition.x + goalDx * 3.05, CAVE_FLOOR_Y + 2.2, goalPosition.z + goalDz * 3.05);
  gate.rotation.y = goalFacing;
  guardian.add(gate);
  group.add(guardian);

  const healingMarkers = new Map();
  for (const cellIndex of layout.furnishings.heals) {
    const marker = createMarker(THREE, 0x62d58a, 'spring');
    const position = caveCellToWorld(layout, cellIndex);
    marker.name = `embermoss-spring-${cellIndex}`;
    marker.position.set(position.x, CAVE_FLOOR_Y, position.z);
    marker.userData.baseY = CAVE_FLOOR_Y;
    group.add(marker);
    healingMarkers.set(cellIndex, marker);
  }

  const lights = [];
  for (const [cellIndex, colour, intensity, distance] of [
    [layout.start, 0xf1a25b, 2.1, 17],
    [layout.goal, 0xd64d33, 2.5, 20],
    ...layout.furnishings.heals.slice(0, mobile ? 1 : 2).map(cell => [cell, 0x55d896, 1.8, 15])
  ]) {
    const position = caveCellToWorld(layout, cellIndex);
    const light = new THREE.PointLight(colour, intensity, distance, 2);
    light.position.set(position.x, CAVE_FLOOR_Y + 2.3, position.z);
    light.castShadow = false;
    lights.push(light);
    group.add(light);
  }
  // A shadow-free explorer light follows the player. This keeps passages
  // readable on phone displays without multiplying expensive shadow maps.
  const explorerLight = new THREE.PointLight(0xffd6a0, mobile ? 2.8 : 3.15, mobile ? 31 : 36, 1.45);
  explorerLight.name = 'lower-ways-player-lantern';
  explorerLight.castShadow = false;
  explorerLight.position.set(entryPosition.x, CAVE_FLOOR_Y + 2.25, entryPosition.z);
  group.add(explorerLight);
  const caveAmbient = new THREE.HemisphereLight(0x63869a, 0x23282a, 1.12);
  group.add(caveAmbient);
  addAuthoredRockLandmarks({ THREE, group, layout, rockAsset, mobile });

  function setRun(run) {
    const claimed = new Set(run?.claimedHeals || []);
    for (const [cellIndex, marker] of healingMarkers) marker.visible = !claimed.has(cellIndex);
    seal.visible = !run?.completed;
    gate.visible = !run?.completed;
  }

  function addRockAsset(asset) {
    return addAuthoredRockLandmarks({ THREE, group, layout, rockAsset: asset, mobile });
  }

  function setVisible(visible, run) {
    group.visible = Boolean(visible);
    if (run) setRun(run);
  }

  function findPath(fromPosition, toPosition) {
    const from = caveWorldToCell(layout, fromPosition);
    const to = caveWorldToCell(layout, toPosition);
    const path = getCavePath(layout, from, to).map(index => caveCellToWorld(layout, index));
    if (path.length) {
      path[0] = { x: fromPosition.x, z: fromPosition.z, y: CAVE_FLOOR_Y };
      path[path.length - 1] = { x: toPosition.x, z: toPosition.z, y: CAVE_FLOOR_Y };
    }
    return path;
  }

  function update(time, playerPosition = null) {
    if (!group.visible) return;
    if (playerPosition) explorerLight.position.set(playerPosition.x, CAVE_FLOOR_Y + 2.18, playerPosition.z);
    explorerLight.intensity = (mobile ? 2.8 : 3.15) + Math.sin(time * 2.1) * .12;
    crystals.material.emissiveIntensity = .72 + Math.sin(time * 1.7) * .18;
    seal.rotation.z = time * .18;
    for (const [index, marker] of [...healingMarkers.values()].entries()) {
      if (!marker.visible) continue;
      marker.position.y = marker.userData.baseY + Math.sin(time * 1.6 + index) * .08;
      marker.rotation.y = time * .12 + index;
    }
  }

  return {
    group,
    layout,
    floorTargets: [floor],
    raycastTargets: [floor, wall],
    setVisible,
    setRun,
    addRockAsset,
    findPath,
    update,
    worldToCell: position => caveWorldToCell(layout, position),
    cellToWorld: cell => caveCellToWorld(layout, cell),
    entrance: entryPosition,
    goal: goalPosition,
    floorY: CAVE_FLOOR_Y
  };
}

export function drawCaveMiniMap({ context, size, layout, run, player, yaw, route = [] }) {
  const ctx = context;
  const scale = Math.min(size * .82 / (layout.width * CAVE_CELL_SIZE), size * .82 / (layout.height * CAVE_CELL_SIZE));
  const centre = size / 2;
  const known = new Set(getVisibleCaveCells(layout, run?.discovered));
  const discovered = new Set(run?.discovered || [layout.start]);
  ctx.clearRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(centre, centre, 10, centre, centre, size * .7);
  gradient.addColorStop(0, '#17272a');
  gradient.addColorStop(1, '#070d11');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const mapPoint = cellIndex => {
    const position = caveCellToWorld(layout, cellIndex);
    return { x: centre + position.x * scale, y: centre + position.z * scale };
  };

  ctx.lineCap = 'round';
  for (const cell of layout.cells) {
    if (!known.has(cell.index)) continue;
    const point = mapPoint(cell.index);
    ctx.fillStyle = discovered.has(cell.index) ? '#38515a' : '#1c2a30';
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(2.4, scale * 2.25), 0, Math.PI * 2);
    ctx.fill();
    for (const direction of CAVE_DIRECTIONS) {
      if (!(cell.passages & direction.bit)) continue;
      const nextX = cell.x + direction.dx;
      const nextY = cell.y + direction.dy;
      const nextIndex = nextY * layout.width + nextX;
      if (!known.has(nextIndex)) continue;
      const next = mapPoint(nextIndex);
      ctx.strokeStyle = discovered.has(cell.index) && discovered.has(nextIndex) ? '#718b8d' : '#2b3c42';
      ctx.lineWidth = Math.max(3, scale * 2.4);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }
  }

  if (route.length > 1) {
    ctx.strokeStyle = '#edc36f';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    route.forEach((position, index) => {
      const x = centre + position.x * scale;
      const y = centre + position.z * scale;
      if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const start = mapPoint(layout.start);
  ctx.fillStyle = '#e8aa63';
  ctx.fillRect(start.x - 3, start.y - 3, 6, 6);
  for (const heal of layout.furnishings.heals) {
    if (!discovered.has(heal) || run?.claimedHeals?.includes(heal)) continue;
    const point = mapPoint(heal);
    ctx.fillStyle = '#65e19a';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (discovered.has(layout.goal)) {
    const goal = mapPoint(layout.goal);
    ctx.fillStyle = run?.completed ? '#6ce79d' : '#e16b50';
    ctx.font = `bold ${Math.max(10, size * .07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(run?.completed ? '✓' : '☠', goal.x, goal.y);
  }

  const px = centre + player.x * scale;
  const py = centre + player.z * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-yaw);
  ctx.fillStyle = '#fff0bd';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#b4c5c6';
  ctx.font = `700 ${Math.max(7, size * .037)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${run?.discovered?.length || 1}/${layout.cells.length} chambers`, 8, size - 8);
}
