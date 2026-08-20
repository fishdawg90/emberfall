// Renderer-only scenery for the hosted world. Gameplay locations and gates stay
// in world-data.js; this module gives each destination a readable identity.

const TOWN_CLUSTERS = Object.freeze({
  town: Object.freeze([
    ['a', -76, -26, 0.88, 1.42], ['b', -77, 67, 0.9, 1.72],
    ['c', 76, 70, 0.84, -1.66], ['a', 77, -54, 0.86, -1.5],
    ['b', -20, -88, 0.82, 0.04], ['c', 38, -91, 0.8, -0.08],
    ['garage', -91, 19, 0.86, 1.54], ['d', 92, 12, 0.82, -1.54]
  ]),
  frostmere: Object.freeze([
    ['a', -20, 9, 0.9, 0.8], ['c', 16, 13, 0.82, -0.72],
    ['garage', -13, -18, 0.86, 2.35], ['a', 19, -14, 0.76, -2.34]
  ]),
  sunspire: Object.freeze([
    ['d', -17, -15, 0.98, 2.35], ['a', 18, -12, 0.84, -2.25],
    ['b', -17, 17, 0.8, 0.78], ['d', 18, 17, 0.76, -0.82]
  ]),
  tidewatch: Object.freeze([
    ['b', -19, -12, 0.9, 2.28], ['c', 16, -15, 0.82, -2.2],
    ['garage', -18, 18, 0.82, 0.82], ['b', 17, 18, 0.76, -0.78]
  ])
});

const TOWN_TINTS = Object.freeze({
  town: 0xc9b18d,
  frostmere: 0xa8c3cd,
  sunspire: 0xd8a963,
  tidewatch: 0x87b7b6
});

function seeded(seed = 1) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function cloneMaterials(THREE, object, tint) {
  const tintColor = tint ? new THREE.Color(tint) : null;
  object.traverse(child => {
    if (!child.isMesh || !child.material) return;
    const materials = (Array.isArray(child.material) ? child.material : [child.material]).map(material => {
      const copy = material.clone();
      if (tintColor && copy.color) copy.color.lerp(tintColor, 0.24);
      copy.roughness = Math.max(0.72, copy.roughness ?? 0.8);
      return copy;
    });
    child.material = Array.isArray(child.material) ? materials : materials[0];
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

export function createAdventureBackdrop({ THREE, scene, height, mobile = false }) {
  const group = new THREE.Group();
  group.name = 'adventure-backdrop';
  const ranges = [
    [-315, -365, 74, 112, 0x58656b], [-245, -382, 105, 154, 0x657077],
    [-155, -370, 66, 104, 0x59666d], [-35, -392, 120, 178, 0x65727a],
    [92, -380, 82, 129, 0x59666b], [205, -372, 108, 156, 0x647077],
    [315, -350, 72, 112, 0x58666d], [-382, -240, 90, 134, 0x5e6c70],
    [378, -205, 96, 142, 0x606c71], [-388, 78, 70, 108, 0x5c696a]
  ];
  const mountainGeometry = new THREE.ConeGeometry(1, 1, mobile ? 6 : 8, 3);
  for (const [x, z, radius, peak, color] of ranges) {
    const mountain = new THREE.Mesh(mountainGeometry, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    mountain.scale.set(radius, peak, radius * 0.72);
    mountain.position.set(x, height(x, z) + peak * 0.45 - 8, z);
    mountain.rotation.y = (x * 0.017 + z * 0.009) % Math.PI;
    mountain.receiveShadow = true;
    group.add(mountain);
    if (peak > 120) {
      const cap = new THREE.Mesh(mountainGeometry, new THREE.MeshStandardMaterial({ color: 0xcbd3d1, roughness: 1, flatShading: true }));
      cap.scale.set(radius * 0.34, peak * 0.23, radius * 0.25);
      cap.position.set(x, height(x, z) + peak * 0.88, z);
      cap.rotation.y = mountain.rotation.y;
      group.add(cap);
    }
  }

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(88, mobile ? 28 : 44),
    new THREE.MeshStandardMaterial({ color: 0x477f91, metalness: 0.08, roughness: 0.28, transparent: true, opacity: 0.88 })
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(1.35, 0.78, 1);
  water.position.set(262, height(210, 270) - 2.1, 324);
  water.receiveShadow = true;
  group.add(water);
  scene.add(group);
  return group;
}

export function decorateAdventureWorld({ THREE, scene, assets, height, propPlace, roadDist, landmarks, lots, addCollider, mobile = false }) {
  const group = new THREE.Group();
  group.name = 'regional-town-detail';
  const landmarkById = new Map(landmarks.map(entry => [entry.id, entry]));

  function placeBuilding(key, x, z, scale, rotation, tint, collide = true) {
    const source = assets[key];
    if (!source) return null;
    const object = source.clone(true);
    cloneMaterials(THREE, object, tint);
    object.scale.multiplyScalar(scale);
    object.rotation.y = rotation;
    const size = source.userData.size;
    const width = size?.x * scale || 5;
    const depth = size?.z * scale || 5;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const samples = [[0, 0], [-width / 2, -depth / 2], [width / 2, -depth / 2], [-width / 2, depth / 2], [width / 2, depth / 2]]
      .map(([localX, localZ]) => height(x + localX * cosine + localZ * sine, z - localX * sine + localZ * cosine));
    const bottom = Math.min(...samples) - 0.28;
    const top = Math.max(...samples) + 0.05;
    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.04, Math.max(0.2, top - bottom), depth * 1.04),
      new THREE.MeshStandardMaterial({ color: 0x655f58, roughness: 1 })
    );
    foundation.position.set(x, bottom + (top - bottom) / 2, z);
    foundation.rotation.y = rotation;
    foundation.receiveShadow = true;
    object.position.set(x, top - 0.04, z);
    if (collide && size) addCollider?.(x, z, Math.max(size.x, size.z) * scale * 0.31);
    group.add(foundation);
    group.add(object);
    return object;
  }

  for (const [townId, buildings] of Object.entries(TOWN_CLUSTERS)) {
    const landmark = landmarkById.get(townId);
    if (!landmark) continue;
    for (const [key, ox, oz, scale, rotation] of buildings) {
      const x = landmark.x + ox;
      const z = landmark.z + oz;
      if (lots.some(lot => Math.hypot(x - lot.x, z - lot.z) < lot.rad + 6)) continue;
      placeBuilding(key, x, z, scale, rotation, TOWN_TINTS[townId]);
    }
  }

  // Frostmere: cold stone, snow pockets, sparse crooked pines.
  const frostmere = landmarkById.get('frostmere');
  if (frostmere) {
    const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xd8e2df, roughness: 1 });
    for (let index = 0; index < (mobile ? 7 : 12); index += 1) {
      const angle = index * 2.399;
      const radius = 10 + (index * 11) % 38;
      const x = frostmere.x + Math.cos(angle) * radius;
      const z = frostmere.z + Math.sin(angle) * radius;
      const patch = new THREE.Mesh(new THREE.CircleGeometry(5 + index % 4, 14), snowMaterial);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x, height(x, z) + 0.07, z);
      patch.scale.y = 0.55;
      group.add(patch);
      if (index % 3 === 0) propPlace('tree2', x + 4, z - 2, 0.78, angle);
    }
  }

  // Sunspire: warm plaza, market colour, and a visible processional approach.
  const sunspire = landmarkById.get('sunspire');
  if (sunspire) {
    propPlace('fountain', sunspire.x, sunspire.z + 8, 1.25, 0);
    for (const [x, z, key] of [[-9, 1, 'stallR'], [10, 2, 'stallG'], [-11, 15, 'lamp'], [11, 15, 'lamp']]) {
      propPlace(key, sunspire.x + x, sunspire.z + z, key === 'lamp' ? 0.95 : 1, 0);
    }
  }

  // Tidewatch: a timber-and-lantern shoreline with carts arriving from Greyfen.
  const tidewatch = landmarkById.get('tidewatch');
  if (tidewatch) {
    for (let index = 0; index < 7; index += 1) propPlace('fence', tidewatch.x + 23 - index * 3, tidewatch.z + 25, 0.9, Math.PI / 2);
    propPlace('cart', tidewatch.x - 4, tidewatch.z - 24, 0.92, -0.4);
    propPlace('stallG', tidewatch.x + 7, tidewatch.z + 7, 0.92, 0.1);
  }

  // Whisperwood becomes visibly dense well before the player reaches it.
  const forest = landmarkById.get('forest');
  const random = seeded(7129);
  if (forest) {
    const count = mobile ? 34 : 58;
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 10 + Math.sqrt(random()) * 69;
      const x = forest.x + Math.cos(angle) * radius;
      const z = forest.z + Math.sin(angle) * radius;
      if (roadDist(x, z) < 4.5 || lots.some(lot => Math.hypot(x - lot.x, z - lot.z) < lot.rad + 3)) continue;
      propPlace(index % 5 === 0 ? 'tree3' : index % 2 ? 'tree2' : 'tree', x, z, 0.78 + random() * 0.48, random() * Math.PI * 2);
    }
  }

  // The Lower Ways entrance reads as a broken rock gate instead of a lone garage.
  const cave = landmarkById.get('cave');
  if (cave) {
    for (const [ox, oz, scale, rotation] of [[-10, 2, 2.2, 0.4], [10, 1, 2.35, -0.45], [-5, -8, 1.55, 1.1], [6, -9, 1.7, -0.9]]) {
      propPlace('rock', cave.x + ox, cave.z + oz, scale, rotation);
    }
    for (const side of [-1, 1]) propPlace('lamp', cave.entry.x + side * 3.4, cave.entry.z, 1.05, 0);
  }

  // Roadside details make the long journey readable without filling the scene.
  for (let index = 0; index < landmarks.length; index += 1) {
    const landmark = landmarks[index];
    if (landmark.id === 'town') continue;
    const dx = landmark.entry.x - landmark.x;
    const dz = landmark.entry.z - landmark.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    for (const side of [-1, 1]) propPlace('lamp', landmark.entry.x + nx * side * 3, landmark.entry.z + nz * side * 3, 0.9, 0);
  }

  scene.add(group);
  return group;
}

export function drawAdventureMap({ context, size, worldLimit, player, roads, landmarks, height, state }) {
  const ctx = context;
  const mapPoint = (x, z) => [(x + worldLimit) / (worldLimit * 2) * size, (z + worldLimit) / (worldLimit * 2) * size];
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#13252b');
  gradient.addColorStop(0.55, '#193125');
  gradient.addColorStop(1, '#20372c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Region washes.
  const washes = { frostmere: '#9bb7bd30', sunspire: '#c7954c32', tidewatch: '#438b9438', forest: '#214f3048', cave: '#332c3548', town: '#94744622' };
  for (const landmark of landmarks) {
    const [x, y] = mapPoint(landmark.x, landmark.z);
    ctx.fillStyle = washes[landmark.id] || '#ffffff12';
    ctx.beginPath();
    ctx.arc(x, y, landmark.radius / (worldLimit * 2) * size * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lightweight topographic hatching based on the real terrain function.
  ctx.strokeStyle = '#d8d0a50d';
  ctx.lineWidth = 1;
  for (let z = -worldLimit; z <= worldLimit; z += 44) {
    ctx.beginPath();
    for (let x = -worldLimit; x <= worldLimit; x += 12) {
      const [mx, my] = mapPoint(x, z + height(x, z) * 0.72);
      if (x === -worldLimit) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
    }
    ctx.stroke();
  }

  // Tidewatch sea and shoreline.
  const [seaX, seaY] = mapPoint(262, 324);
  ctx.fillStyle = '#39798988';
  ctx.beginPath();
  ctx.ellipse(seaX, seaY, 81, 45, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#85bcc477';
  for (let wave = -1; wave <= 1; wave += 1) {
    ctx.beginPath();
    ctx.arc(seaX, seaY + wave * 12, 37 + wave * 6, 0.12, 2.9);
    ctx.stroke();
  }

  // Northern mountain symbols match the horizon range.
  ctx.fillStyle = '#8b9999';
  for (let index = 0; index < 9; index += 1) {
    const x = 24 + index * 69;
    const peak = 18 + (index % 3) * 8;
    ctx.beginPath();
    ctx.moveTo(x, 42);
    ctx.lineTo(x + 22, 42 - peak);
    ctx.lineTo(x + 44, 42);
    ctx.fill();
  }

  // Forest canopy marks.
  const forest = landmarks.find(entry => entry.id === 'forest');
  if (forest) {
    const [fx, fy] = mapPoint(forest.x, forest.z);
    ctx.fillStyle = '#4e8356aa';
    for (let index = 0; index < 18; index += 1) {
      const angle = index * 2.399;
      const radius = 5 + (index * 9) % 33;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(angle) * radius, fy + Math.sin(angle) * radius, 3 + index % 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.lineCap = 'round';
  for (const route of roads) {
    ctx.beginPath();
    let point = mapPoint(...route.p[0]);
    ctx.moveTo(...point);
    for (let index = 1; index < route.p.length; index += 1) {
      point = mapPoint(...route.p[index]);
      ctx.lineTo(...point);
    }
    ctx.strokeStyle = route.k === 'main' ? '#f0cd82' : route.k === 'world' ? '#c9aa70' : '#786849';
    ctx.lineWidth = route.k === 'main' ? 5 : route.k === 'world' ? 4 : 2.5;
    ctx.stroke();
  }

  for (const landmark of landmarks) {
    const [x, y] = mapPoint(landmark.x, landmark.z);
    const claimed = landmark.kind !== 'region' || Boolean(state?.explore?.claimed?.[landmark.area]);
    ctx.fillStyle = landmark.kind === 'region' ? (claimed ? '#72c48d' : '#6f8f77') : '#f0c979';
    ctx.beginPath();
    ctx.arc(x, y, landmark.id === 'town' ? 10 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#071018';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#f5ddb0';
    ctx.font = 'bold 12px system-ui';
    ctx.fillText(landmark.name, x + 12, y + 4);
    ctx.fillStyle = '#9eaaa5';
    ctx.font = '8px system-ui';
    ctx.fillText(landmark.subtitle, x + 12, y + 14);
  }

  const [px, py] = mapPoint(player.x, player.z);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#18222a';
  ctx.lineWidth = 2;
  ctx.stroke();
}
