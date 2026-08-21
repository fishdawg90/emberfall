import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, game, worldVisuals, activityVisuals, combatVisuals, caveData, caveServices, caveVisuals] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('game.js', root), 'utf8'),
  readFile(new URL('world-visuals.js', root), 'utf8'),
  readFile(new URL('activity-visuals.js', root), 'utf8'),
  readFile(new URL('combat-visuals.js', root), 'utf8'),
  readFile(new URL('cave-data.js', root), 'utf8'),
  readFile(new URL('cave-services.js', root), 'utf8'),
  readFile(new URL('cave-visuals.js', root), 'utf8')
]);

test('hosted shell retains mobile navigation, camera direction, assets, roads, and debug report', () => {
  assert.match(html, /id="debugBtn"/);
  assert.match(html, /window\.EmberDebug/);
  assert.match(html, /<b>Tap<\/b> to walk/);
  assert.match(game, /yaw\+=dx\*\.0045/);
  assert.match(game, /pitch=clamp\(pitch-dy\*\.0037/);
  assert.match(game, /building-small-a\.glb/);
  assert.match(game, /new THREE\.CanvasTexture\(c\)/);
});

test('migrated gameplay dock is loaded without replacing the Three.js runtime', () => {
  assert.match(html, /class="gameDock"/);
  assert.match(html, /id="gamePanel"/);
  assert.match(html, /game\.js\?v=15/);
  assert.match(game, /createGameUI/);
  assert.match(game, /new THREE\.WebGLRenderer/);
  assert.match(game, /saveGameState/);
});

test('five persistent premade Greyfen services route walking into migrated systems', () => {
  assert.match(html, /id="worldServices"/);
  for (const id of ['mine', 'forge', 'smelter', 'market', 'inn']) {
    assert.match(game, new RegExp(`id:'${id}'`));
  }
  assert.match(game, /building-small-d\.glb/);
  assert.match(game, /building-garage\.glb/);
  assert.match(game, /setServiceTarget/);
  assert.match(game, /gameUI\.open\(service\.tab\)/);
  assert.match(game, /syncTownServices/);
});

test('continuous overworld paints long routes and places complete landmark assets', () => {
  assert.match(html, /world map/i);
  assert.match(game, /WORLD_ROUTES/);
  assert.match(game, /route\.points\.map/);
  assert.match(game, /R\.k==='world'/);
  assert.match(game, /landmark\.building/);
  assert.match(game, /setLandmarkTarget/);
  assert.match(game, /Math\.abs\(x\)>WORLD_LIMIT/);
});

test('adventure visual layer uses complete building assets for distinct towns and richer map landmarks', () => {
  assert.match(game, /createAdventureBackdrop/);
  assert.match(game, /decorateAdventureWorld/);
  assert.match(game, /drawAdventureMap/);
  assert.match(worldVisuals, /TOWN_CLUSTERS/);
  for (const town of ['town', 'frostmere', 'sunspire', 'tidewatch']) {
    assert.match(worldVisuals, new RegExp(`${town}: Object\\.freeze`));
  }
  assert.match(worldVisuals, /assets\[key\]/);
  assert.match(worldVisuals, /source\.clone\(true\)/);
  assert.match(worldVisuals, /adventure-backdrop/);
  assert.match(worldVisuals, /Northern mountain symbols/);
  assert.match(worldVisuals, /Tidewatch sea and shoreline/);
});

test('3D travel checkpoints positions and starts preserved distance encounters', () => {
  assert.match(game, /readHostedWorldPosition/);
  assert.match(game, /writeHostedWorldPosition/);
  assert.match(game, /registerTravelDistance/);
  assert.match(game, /travelled\/9/);
  assert.match(game, /checkpoint 3D world position/);
  assert.match(game, /gameUI\.startEncounter\(\{boss:true/);
  assert.match(game, /return to Greyfen after defeat/);
  assert.match(game, /Journey resumed to/);
});

test('world map supports walking targets and gated fast travel', () => {
  assert.match(html, /id="mapDestinations"/);
  assert.match(html, /Tap a discovered landmark to walk/);
  assert.match(game, /getFastTravelLandmarks/);
  assert.match(game, /function fastTravelTo/);
  assert.match(game, /planCanvas\.addEventListener\('click',mapWalkTarget\)/);
  assert.match(game, /window\.EmberfallWorld/);
});

test('progressive discovery and live minimap connect routes to safe towns', () => {
  assert.match(html, /id="miniMapCanvas"/);
  assert.match(html, /id="miniSafety"/);
  assert.match(html, /SAFE TOWN/);
  assert.match(game, /getKnownLandmarks/);
  assert.match(game, /drawLiveMiniMap/);
  assert.match(game, /Route on foot/);
  assert.match(game, /recordServiceVisit/);
  assert.match(game, /isLandmarkKnown/);
  assert.match(worldVisuals, /function createLivingTowns/);
  assert.match(worldVisuals, /living-towns-and-safe-boundaries/);
  assert.match(worldVisuals, /function createSkyLife/);
  assert.match(worldVisuals, /sun-and-clouds/);
});

test('nearby NPCs speak passively and restoration animates complete service buildings', () => {
  assert.match(html, /id="npcSpeech"/);
  assert.match(game, /updateNpcSpeech/);
  assert.match(worldVisuals, /nearby\(position/);
  assert.match(worldVisuals, /The boundary posts mark/);
  assert.match(game, /beginBuildingUpgrade/);
  assert.match(game, /updateBuildingUpgrades/);
  assert.match(game, /new THREE\.RingGeometry/);
  assert.match(game, /action===`restore \$\{id\}`/);
});

test('coarse-pointer profile reduces expensive Android rendering work', () => {
  assert.match(game, /MOBILE_PROFILE/);
  assert.match(game, /MOBILE_PROFILE\?1\.25:1\.65/);
  assert.match(game, /MOBILE_PROFILE\?1024:2048/);
  assert.match(game, /MOBILE_PROFILE\?112:150/);
  assert.match(game, /MOBILE_PROFILE\?500:750/);
  assert.match(game, /heapPop\(open\)/);
  assert.match(game, /EmberDebug\.log\('PERF'/);
});

test('card combat overlay is wired to the preserved state machine and save path', async () => {
  assert.match(html, /id="combatPanel"/);
  assert.match(game, /createGameUI/);
  const ui = await readFile(new URL('game-ui.js', root), 'utf8');
  assert.match(ui, /class="combatHand"/);
  assert.match(ui, /playExploreCard/);
  assert.match(ui, /endExploreTurn/);
  assert.match(ui, /startExploreCombat/);
  assert.match(ui, /BREAK! Enemy intent cancelled/);
  assert.match(ui, /resumed compatible saved battle/);
  assert.match(ui, /enemyFigureMarkup/);
  assert.match(ui, /outroSnapshot/);
  assert.match(ui, /fx-defeat/);
});

test('combat has visible patrol and mine-gate enemies with mobile CSS animations', () => {
  for (const enemy of ['scavenger', 'crawler', 'stonehorn', 'custodian', 'tunnelmauler', 'glasswarden', 'abysssentinel']) {
    assert.match(combatVisuals, new RegExp(`${enemy}:`));
  }
  assert.match(combatVisuals, /`enemy-\$\{id\}`/);
  assert.match(combatVisuals, /enemyFigureMarkup/);
  assert.match(combatVisuals, /playerWeaponMarkup/);
  for (const animation of ['enemyIdle', 'enemyHit', 'enemyBreak', 'enemyAttack', 'enemyDefeat', 'heroStrike']) {
    assert.match(html, new RegExp(`@keyframes ${animation}`));
  }
  assert.match(html, /combatArena\.area-forest/);
  assert.match(html, /combatArena\.area-cave/);
  assert.match(combatVisuals, /combatSceneryMarkup/);
  assert.match(html, /combatImpact/);
});

test('combat cards include distinct lightweight illustrated art', async () => {
  const ui = await readFile(new URL('game-ui.js', root), 'utf8');
  assert.match(combatVisuals, /CARD_ART/);
  assert.match(combatVisuals, /cardArtMarkup/);
  for (const card of ['slash', 'splitter', 'guard', 'feint', 'heavy', 'silvercut', 'aetherbreak']) {
    assert.match(combatVisuals, new RegExp(`${card}:`));
  }
  assert.match(ui, /cardArtMarkup\(card\.id\)/);
  assert.match(html, /combatCardArt/);
  assert.match(html, /theme-aether/);
});

test('work and forge panels expose mobile-budget first-person Three.js scenes', async () => {
  assert.match(html, /id="activityStage"/);
  assert.match(html, /id="activityCanvas"/);
  assert.match(html, /Animated first-person work scene/);
  assert.match(activityVisuals, /new THREE\.WebGLRenderer/);
  assert.match(activityVisuals, /powerPreference: 'low-power'/);
  for (const builder of ['buildMining', 'buildSmelting', 'buildTraining', 'buildForging']) {
    assert.match(activityVisuals, new RegExp(`function ${builder}`));
  }
  const ui = await readFile(new URL('game-ui.js', root), 'utf8');
  assert.match(ui, /createActivityVisuals/);
  assert.match(ui, /activityVisuals\.show/);
  assert.match(ui, /activityVisuals\.pulse/);
  assert.match(ui, /activityVisuals\.destroy/);
});

test('production rewards fly as earned ore and bars into persistent inventory stacks', async () => {
  const ui = await readFile(new URL('game-ui.js', root), 'utf8');
  assert.match(html, /id="activityGain"/);
  assert.match(html, /@keyframes activityReward/);
  assert.match(activityVisuals, /function reward\(/);
  assert.match(activityVisuals, /new THREE\.InstancedMesh/);
  assert.match(activityVisuals, /const instances = Math\.min\(total, 96\)/);
  assert.match(activityVisuals, /function renderStack/);
  assert.match(activityVisuals, /mode === 'mining' \? 'ore' : 'bar'/);
  assert.match(ui, /function showWorkReward/);
  assert.match(ui, /activityVisuals\.reward/);
  assert.match(ui, /\.\.\.activityStack\(state, 'forging', result\.metal\)/);
});

test('quick intro and mission journal connect the full gameplay loop', async () => {
  const ui = await readFile(new URL('game-ui.js', root), 'utf8');
  const journey = await readFile(new URL('journey-services.js', root), 'utf8');
  assert.match(html, /id="introOverlay"/);
  assert.match(html, /Restore Greyfen\. Reopen the world/);
  assert.match(html, /id="missionTracker"/);
  assert.match(html, /data-open-game-tab="journal"/);
  assert.match(html, /id="missionRoute"/);
  assert.doesNotMatch(html, /id="gamePanelTabs"/);
  assert.doesNotMatch(ui, /class="systemThread"/);
  assert.match(html, /id="gameDock"/);
  assert.doesNotMatch(html.match(/<nav class="gameDock"[\s\S]*?<\/nav>/)?.[0] || '', /data-open-game-tab="market"/);
  assert.match(ui, /getInterfaceUnlocks/);
  assert.match(ui, /compactHelp/);
  assert.match(ui, /journalGroup/);
  assert.match(ui, /getMissionJournal/);
  assert.match(ui, /getActiveMission/);
  assert.match(ui, /reset-confirm/);
  assert.match(game, /resetGameState/);
  assert.match(ui, /challenge-gate/);
  assert.match(game, /recordTownArrival/);
  assert.match(game, /journeyWorldAction/);
  assert.match(journey, /visit-frostmere/);
  assert.match(journey, /explore-lower-ways/);
  assert.match(journey, /find-mine/);
  assert.match(journey, /getGreyfenTasks/);
  assert.match(ui, /route-service/);
});

test('Lower Ways is a resumable generated expedition rather than a landmark patrol shortcut', () => {
  assert.match(caveData, /Iterative recursive-backtracker/);
  assert.match(caveData, /Light braiding/);
  assert.match(caveData, /chooseFurnishings/);
  assert.match(caveServices, /useNearbyCaveHealing/);
  assert.match(caveServices, /markCaveBossStarted/);
  assert.match(game, /startLowerWays/);
  assert.match(game, /routeCaveDeeper/);
  assert.match(game, /Encounter cleared · deeper route resumed/);
  assert.match(game, /enemyId:'custodian'/);
  assert.match(game, /checkpoint Lower Ways position/);
  assert.match(html, /id="unlockOverlay"/);
  assert.match(html, /Deepsteel unlocked!/);
});

test('Lower Ways visuals use mobile-budget instancing, authored CC0 rocks, cave atmosphere, and a fog-of-war minimap', () => {
  assert.match(caveVisuals, /new THREE\.InstancedMesh/);
  assert.match(caveVisuals, /lower-ways-rock-walls/);
  assert.match(caveVisuals, /lower-ways-instanced-rubble/);
  assert.match(caveVisuals, /lower-ways-mine-supports/);
  assert.match(caveVisuals, /addAuthoredRockLandmarks/);
  assert.match(caveVisuals, /drawCaveMiniMap/);
  assert.match(caveVisuals, /claimedHeals/);
  assert.match(game, /applyCaveAtmosphere/);
  assert.match(game, /caveWorld\?\.addRockAsset\(assets\.rock\)/);
  assert.match(game, /DANGER · \$\{gameState\.explore\.hp\}/);
});

test('phone UI keeps locked progression visible and raises gameplay text sizes', async () => {
  const ui = await readFile(new URL('game-ui.js', root), 'utf8');
  const journey = await readFile(new URL('journey-services.js', root), 'utf8');
  assert.match(ui, /getMetalUnlockState/);
  assert.match(ui, /class="resourcePicker"/);
  assert.match(ui, /class="unlockGrid"/);
  assert.match(ui, /locked-hint/);
  assert.match(ui, /element\.classList\.toggle\('locked', locked\)/);
  assert.match(journey, /Secure the Lower Ways/);
  assert.match(journey, /Glass Warden/);
  assert.match(journey, /Abyss Sentinel/);
  assert.match(html, /\.gamePanelBody button\{min-height:42px/);
  assert.match(html, /\.missionTracker>strong\{min-height:25px/);
  assert.match(html, /\.combatCard\{flex:0 0 124px/);
  assert.match(html, /\.unlockGrid,\.forgeMetalGrid\{grid-template-columns:1fr 1fr\}/);
});
