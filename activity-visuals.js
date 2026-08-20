// A deliberately small Three.js renderer for first-person production scenes.
// It only runs while the work/forge panel is open and never owns game state.

const LABELS = Object.freeze({
  mining: ['THE MINE FACE', 'Tap Start Mining to swing the pick'],
  smelting: ['THE SMELTER', 'Ore and heat become workable bars'],
  combat: ['THE TRAINING YARD', 'Training sharpens expedition combat'],
  forging: ['THE SMITHY', 'Shape equipped gear at the anvil']
});

export function createActivityVisuals({ canvas, container, caption, getState, debug = window.EmberDebug }) {
  const THREE = window.THREE;
  if (!THREE || !canvas || !container) return { show() {}, hide() {}, update() {}, pulse() {}, destroy() {} };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch (error) {
    debug?.log('VISUAL', 'activity renderer unavailable', error?.message || error);
    return { show() {}, hide() {}, update() {}, pulse() {}, destroy() {} };
  }

  const mobile = matchMedia('(pointer:coarse)').matches || innerWidth < 720;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11191d);
  scene.fog = new THREE.Fog(0x11191d, 7, 21);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 40);
  camera.position.set(0, 1.62, 5.1);
  camera.lookAt(0, 1.25, -2.5);
  scene.add(new THREE.HemisphereLight(0xa9bbc4, 0x2d251e, 1.15));
  const keyLight = new THREE.DirectionalLight(0xffd29a, 1.6);
  keyLight.position.set(-3, 6, 5);
  scene.add(keyLight);
  const fireLight = new THREE.PointLight(0xff6b2c, 0, 9, 2);
  fireLight.position.set(0, 1.3, -2.2);
  scene.add(fireLight);

  const environment = new THREE.Group();
  const tool = new THREE.Group();
  scene.add(environment, tool);
  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...extra });
  const metal = (color = 0x747b7c, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.44, metalness: 0.72, ...extra });
  const emissive = (color, intensity = 2.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.55 });
  const box = (group, size, position, material, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    group.add(mesh);
    return mesh;
  };
  const cylinder = (group, radius, length, position, material, rotation = [0, 0, 0], segments = 10) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    group.add(mesh);
    return mesh;
  };
  const sphere = (group, radius, position, material, scale = [1, 1, 1], segments = 10) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(6, Math.floor(segments * 0.7))), material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    group.add(mesh);
    return mesh;
  };
  const particles = (group, count, color, volume, size = 0.035) => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * volume[0];
      positions[index * 3 + 1] = Math.random() * volume[1] + volume[4];
      positions[index * 3 + 2] = (Math.random() - 0.5) * volume[2] + volume[3];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(points);
    return { points, floor: volume[4], ceiling: volume[4] + volume[1] };
  };
  const floor = material => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 20), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, -3);
    environment.add(mesh);
  };
  const hand = (x, y, z, rotation = [0, 0, 0]) => cylinder(tool, 0.13, 0.56, [x, y, z], standard(0xa97050), rotation, 8);

  let mode = '';
  let visible = false;
  let running = false;
  let progress = 0;
  let pulseUntil = 0;
  let animationFrame = 0;
  let fireBase = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let accentMaterial = null;
  let animated = {};

  function disposeGroup(group) {
    for (const child of [...group.children]) {
      child.traverse(node => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(item => item.dispose?.());
        else node.material?.dispose?.();
      });
      group.remove(child);
    }
  }

  function caveShell() {
    floor(standard(0x383b38));
    box(environment, [8, 5, 0.8], [0, 2.45, -5.2], standard(0x3c4140), [-0.03, 0, 0]);
    box(environment, [1.4, 5, 10], [-4.2, 2.3, -1], standard(0x303536), [0, 0, -0.08]);
    box(environment, [1.4, 5, 10], [4.2, 2.3, -1], standard(0x303536), [0, 0, 0.08]);
    for (let index = 0; index < 9; index += 1) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + index % 3 * 0.17, 0), standard(index % 2 ? 0x444845 : 0x343938));
      rock.scale.set(1.5, 0.8, 1);
      rock.position.set(-3.2 + index * 0.82, 0.3 + index % 2 * 0.2, -4.55 + index % 3 * 0.28);
      environment.add(rock);
    }
  }

  function buildMining() {
    scene.background.setHex(0x101719);
    scene.fog.color.setHex(0x101719);
    fireBase = 1.9;
    fireLight.intensity = fireBase;
    caveShell();
    const timber = standard(0x5b422c);
    for (const z of [-4.15, -1.35]) {
      box(environment, [0.34, 3.9, 0.34], [-2.85, 1.95, z], timber);
      box(environment, [0.34, 3.9, 0.34], [2.85, 1.95, z], timber);
      box(environment, [6.15, 0.34, 0.42], [0, 3.82, z], timber);
    }
    for (const side of [-0.62, 0.62]) box(environment, [0.12, 0.08, 9], [side, 0.11, -0.8], metal(0x62696b));
    for (let index = 0; index < 9; index += 1) box(environment, [1.8, 0.09, 0.22], [0, 0.08, 2.5 - index * 0.82], timber);
    const cart = new THREE.Group();
    box(cart, [1.35, 0.62, 1.65], [-2.0, 0.58, -2.0], metal(0x485054), [0.08, 0, 0]);
    for (const z of [-2.55, -1.45]) cylinder(cart, 0.24, 1.62, [-2.0, 0.24, z], metal(0x282e30), [0, 0, Math.PI / 2], 10);
    environment.add(cart);
    const lanternGlow = sphere(environment, 0.14, [2.15, 2.65, -3.95], emissive(0xffb356, 3.4), [1, 1.25, 1], 9);
    box(environment, [0.45, 0.55, 0.35], [2.15, 2.66, -3.95], metal(0x3d4547, { transparent: true, opacity: 0.62 }));
    accentMaterial = emissive(0xd6975e, 1.45);
    for (let index = 0; index < 8; index += 1) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + index % 3 * 0.07, 0), accentMaterial);
      crystal.scale.y = 1.5;
      crystal.position.set(-1.4 + index * 0.4, 1 + index % 3 * 0.37, -4.72 + index % 2 * 0.12);
      crystal.rotation.z = index * 0.46;
      environment.add(crystal);
    }
    const pick = new THREE.Group();
    cylinder(pick, 0.07, 2.25, [0, 0, 0], standard(0x765335), [0, 0, -0.16], 9);
    box(pick, [1.05, 0.15, 0.16], [0, 1.03, 0], metal(0x82898b), [0, 0, 0.03]);
    pick.position.set(0.72, 0.82, 2.5);
    pick.rotation.set(0.1, -0.2, -0.54);
    tool.add(pick);
    hand(0.82, 0.36, 2.45, [0, 0, -0.26]);
    hand(0.48, 1.12, 2.43, [0, 0, -0.32]);
    animated = { primary: pick, base: pick.rotation.clone(), impact: environment.children.at(-1), particles: particles(environment, mobile ? 16 : 28, 0xd6c6a4, [6.5, 3.4, 6, -2.1, 0.35]), particleSpeed: 0.0025, lanternGlow };
  }

  function buildSmelting() {
    scene.background.setHex(0x171719);
    scene.fog.color.setHex(0x171719);
    fireBase = 4.2;
    fireLight.intensity = fireBase;
    floor(standard(0x393735));
    box(environment, [9, 5, 0.7], [0, 2.5, -5], standard(0x45403a));
    box(environment, [3.8, 3.2, 1.8], [0, 1.55, -3.9], standard(0x3b3b3a));
    box(environment, [1.85, 1.65, 0.25], [0, 1.35, -2.95], emissive(0xff5d21, 3.6));
    const brick = standard(0x5d4b40);
    for (let row = 0; row < 4; row += 1) for (let column = -3; column <= 3; column += 1) box(environment, [0.62, 0.28, 0.42], [column * 0.66 + (row % 2) * 0.3, 0.28 + row * 0.3, -2.72], brick);
    box(environment, [0.82, 3.2, 0.82], [1.45, 3.3, -4.1], standard(0x3c3b39));
    box(environment, [2.2, 0.18, 0.72], [-2.4, 1.15, -3.05], standard(0x4c3828));
    for (let index = 0; index < 3; index += 1) box(environment, [0.48, 0.16, 0.7], [-2.9 + index * 0.55, 1.33, -3.04], metal(0x555c5e));
    const bellows = new THREE.Group();
    sphere(bellows, 0.55, [2.45, 0.74, -2.65], standard(0x6d3e2e), [1.5, 0.65, 1.0], 10);
    cylinder(bellows, 0.08, 1.3, [2.45, 0.8, -1.85], standard(0x765335), [Math.PI / 2, 0, 0], 8);
    environment.add(bellows);
    for (let index = 0; index < 5; index += 1) {
      const bar = box(environment, [0.95, 0.18, 0.28], [-2.6 + index * 0.35, 0.17 + index * 0.13, -2.45], metal(0x737a7e), [0, index * 0.08, index * 0.05]);
      bar.rotation.y = 0.35;
    }
    accentMaterial = emissive(0xe89143, 2.2);
    const crucible = cylinder(tool, 0.45, 0.56, [0.5, 0.92, 2.35], metal(0x34393b), [Math.PI / 2, 0, 0], 12);
    const molten = cylinder(tool, 0.39, 0.04, [0.5, 0.92, 2.05], accentMaterial, [Math.PI / 2, 0, 0], 14);
    const tongs = new THREE.Group();
    for (const side of [-1, 1]) cylinder(tongs, 0.035, 1.8, [side * 0.12, 0, 0], metal(0x687074), [0, 0, side * 0.08], 7);
    tongs.position.set(0.48, 0.72, 2.62);
    tongs.rotation.z = -0.42;
    tool.add(tongs);
    hand(0.96, 0.3, 2.65, [0, 0, -0.45]);
    animated = { primary: tongs, secondary: crucible, glow: molten, base: tongs.rotation.clone(), particles: particles(environment, mobile ? 18 : 34, 0xff9a48, [2.0, 2.8, 1.4, -2.75, 0.9]), particleSpeed: 0.012 };
  }

  function buildTraining() {
    scene.background.setHex(0x657b78);
    scene.fog.color.setHex(0x657b78);
    fireBase = 0;
    fireLight.intensity = fireBase;
    floor(standard(0x5d6d49));
    box(environment, [10, 0.35, 0.45], [0, 2.6, -5], standard(0x726048));
    for (let side = -3; side <= 3; side += 1.5) cylinder(environment, 0.08, 3, [side, 1.5, -4.9], standard(0x5c4632), [0, 0, 0], 7);
    for (const side of [-1, 1]) {
      box(environment, [0.12, 3.2, 0.12], [side * 2.6, 1.6, -4.45], standard(0x59412d));
      box(environment, [1.05, 1.35, 0.08], [side * 2.6, 2.65, -4.38], standard(side < 0 ? 0x7b3435 : 0x355b72), [0, 0, side * 0.08]);
    }
    box(environment, [2.6, 0.18, 0.42], [-2.35, 1.45, -2.7], standard(0x4e3828), [0, -0.2, 0]);
    for (let index = 0; index < 4; index += 1) cylinder(environment, 0.035, 1.5, [-3.15 + index * 0.42, 2.05, -2.68], metal(0x81898b), [0, 0, -0.18 + index * 0.1], 7);
    for (const side of [-1, 1]) {
      cylinder(environment, 0.42, 0.72, [side * 3.1, 0.36, -1.85], standard(0x6b4c32), [0, 0, 0], 12);
      cylinder(environment, 0.44, 0.05, [side * 3.1, 0.72, -1.85], metal(0x5f6564), [0, 0, 0], 12);
    }
    const dummy = new THREE.Group();
    cylinder(dummy, 0.16, 3.1, [0, 1.55, 0], standard(0x684a2f), [0, 0, 0], 8);
    cylinder(dummy, 0.23, 1.85, [0, 2.15, 0], standard(0x80613e), [0, 0, Math.PI / 2], 8);
    const shield = cylinder(dummy, 0.73, 0.12, [0, 1.75, 0.12], standard(0x864c34), [Math.PI / 2, 0, 0], 16);
    shield.scale.y = 1.15;
    dummy.position.set(0, 0, -3.45);
    environment.add(dummy);
    const sword = new THREE.Group();
    box(sword, [0.12, 2.15, 0.09], [0, 0.75, 0], metal(0xbac5c7));
    box(sword, [0.85, 0.1, 0.12], [0, -0.28, 0], metal(0xa87837));
    cylinder(sword, 0.075, 0.58, [0, -0.6, 0], standard(0x59422f), [0, 0, 0], 8);
    sword.position.set(0.8, 0.62, 2.5);
    sword.rotation.set(0.05, -0.2, -0.48);
    tool.add(sword);
    hand(0.94, 0.28, 2.55, [0, 0, -0.3]);
    animated = { primary: sword, target: dummy, base: sword.rotation.clone(), particles: particles(environment, mobile ? 10 : 18, 0xd8d1ad, [7, 2.3, 4.2, -2.2, 0.25]), particleSpeed: 0.0015 };
  }

  function buildForging() {
    scene.background.setHex(0x161719);
    scene.fog.color.setHex(0x161719);
    fireBase = 3.4;
    fireLight.intensity = fireBase;
    floor(standard(0x3b3834));
    box(environment, [9, 5, 0.7], [0, 2.5, -5], standard(0x48413a));
    box(environment, [2.4, 0.48, 1.15], [0, 1.03, -2.9], metal(0x555d60));
    box(environment, [1.15, 0.8, 0.75], [0, 0.47, -2.9], standard(0x34383a));
    box(environment, [2.15, 2.65, 1.25], [2.65, 1.33, -3.82], standard(0x443d37));
    box(environment, [1.25, 1.25, 0.2], [2.65, 1.25, -3.12], emissive(0xff5f27, 3.2));
    box(environment, [1.05, 3.1, 1.0], [2.65, 3.95, -4.0], standard(0x393938));
    box(environment, [3.0, 0.16, 0.68], [-2.4, 2.45, -4.12], standard(0x5a402d));
    for (let index = 0; index < 5; index += 1) {
      cylinder(environment, 0.035, 1.3 + index % 2 * 0.35, [-3.4 + index * 0.48, 1.75, -4.0], metal(0x747d80), [0, 0, -0.28 + index * 0.13], 7);
      sphere(environment, 0.11 + index % 2 * 0.05, [-3.4 + index * 0.48, 1.11, -4.0], metal(0x666e70), [1.4, 0.7, 0.8], 8);
    }
    box(environment, [1.7, 0.62, 1.15], [-2.65, 0.42, -2.15], standard(0x3e4b4f));
    box(environment, [1.48, 0.08, 0.94], [-2.65, 0.75, -2.15], new THREE.MeshStandardMaterial({ color: 0x315d69, roughness: 0.2, metalness: 0.15 }));
    accentMaterial = emissive(0xff7432, 2.7);
    const hotBar = box(environment, [1.35, 0.12, 0.28], [0, 1.34, -2.52], accentMaterial, [0.08, 0.12, 0]);
    const hammer = new THREE.Group();
    cylinder(hammer, 0.075, 1.65, [0, 0, 0], standard(0x765335), [0, 0, 0], 9);
    box(hammer, [0.9, 0.32, 0.34], [0, 0.78, 0], metal(0x747b7c));
    hammer.position.set(0.82, 0.7, 2.45);
    hammer.rotation.set(0.08, -0.18, -0.55);
    tool.add(hammer);
    hand(0.95, 0.25, 2.5, [0, 0, -0.35]);
    const tongs = new THREE.Group();
    for (const side of [-1, 1]) cylinder(tongs, 0.035, 1.55, [side * 0.1, 0, 0], metal(0x687074), [0, 0, side * 0.06], 7);
    tongs.position.set(-0.85, 0.6, 2.4);
    tongs.rotation.z = 0.62;
    tool.add(tongs);
    hand(-0.95, 0.27, 2.48, [0, 0, 0.42]);
    animated = { primary: hammer, target: hotBar, base: hammer.rotation.clone(), particles: particles(environment, mobile ? 22 : 42, 0xffa34e, [2.8, 2.5, 1.8, -2.55, 0.75]), particleSpeed: 0.016 };
  }

  function rebuild(nextMode) {
    disposeGroup(environment);
    disposeGroup(tool);
    accentMaterial = null;
    animated = {};
    mode = nextMode;
    if (mode === 'mining') buildMining();
    else if (mode === 'smelting') buildSmelting();
    else if (mode === 'combat') buildTraining();
    else buildForging();
    const [title, description] = LABELS[mode] || LABELS.mining;
    if (caption) caption.innerHTML = `<strong>${title}</strong><span>${description}</span>`;
    container.dataset.mode = mode;
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate(time) {
    if (!visible) {
      animationFrame = 0;
      return;
    }
    resize();
    const seconds = time * 0.001;
    const action = running || time < pulseUntil;
    const cycle = action ? (progress * Math.PI * 2 + seconds * (running ? 1.2 : 0.3)) : seconds * 0.55;
    if (animated.primary && animated.base) {
      animated.primary.rotation.copy(animated.base);
      if (mode === 'mining' || mode === 'forging') animated.primary.rotation.z += action ? Math.max(0, Math.sin(cycle)) * 0.78 : Math.sin(seconds * 1.4) * 0.025;
      else if (mode === 'combat') animated.primary.rotation.z += action ? Math.sin(cycle) * 0.52 : Math.sin(seconds * 1.2) * 0.025;
      else animated.primary.rotation.x += action ? Math.sin(cycle) * 0.12 : 0;
    }
    if (animated.target && mode === 'combat') animated.target.rotation.z = action ? Math.sin(cycle) * 0.025 : Math.sin(seconds) * 0.008;
    if (animated.glow) animated.glow.material.emissiveIntensity = 2 + Math.sin(seconds * 7) * 0.42;
    if (animated.particles) {
      const attribute = animated.particles.points.geometry.attributes.position;
      for (let index = 0; index < attribute.count; index += 1) {
        const next = attribute.getY(index) + animated.particleSpeed * (1 + index % 4) * (action ? 2.1 : 0.55);
        attribute.setY(index, next > animated.particles.ceiling ? animated.particles.floor : next);
      }
      attribute.needsUpdate = true;
      animated.particles.points.material.opacity = action ? 0.88 : 0.36;
    }
    if (accentMaterial) accentMaterial.emissiveIntensity = Math.max(0.9, (accentMaterial.emissiveIntensity || 1.5) + Math.sin(seconds * 6.4) * 0.025);
    fireLight.intensity = fireBase * (1 + Math.sin(seconds * 8.2) * 0.08);
    camera.position.y = 1.62 + Math.sin(seconds * 1.8) * 0.012;
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  }

  function update(options = {}) {
    running = Boolean(options.running);
    progress = Number.isFinite(options.progress) ? options.progress : 0;
    if (accentMaterial && options.metalColor) {
      accentMaterial.color.set(options.metalColor);
      accentMaterial.emissive.set(options.metalColor);
    }
  }

  function show(nextMode, options = {}) {
    if (!LABELS[nextMode]) return hide();
    if (mode !== nextMode) rebuild(nextMode);
    update(options);
    visible = true;
    container.classList.add('show');
    container.setAttribute('aria-hidden', 'false');
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
  }

  function hide() {
    visible = false;
    container.classList.remove('show');
    container.setAttribute('aria-hidden', 'true');
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function pulse(duration = 520) {
    pulseUntil = performance.now() + duration;
  }

  function destroy() {
    hide();
    disposeGroup(environment);
    disposeGroup(tool);
    renderer.dispose();
  }

  debug?.log('VISUAL', 'first-person activity renderer ready', { profile: mobile ? 'mobile' : 'desktop' });
  return { show, hide, update, pulse, destroy, getMode: () => mode, getState };
}
