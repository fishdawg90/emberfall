import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, game] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('game.js', root), 'utf8')
]);

test('hosted shell retains mobile navigation, camera direction, assets, roads, and debug report', () => {
  assert.match(html, /id="debugBtn"/);
  assert.match(html, /window\.EmberDebug/);
  assert.match(html, /Tap to walk/);
  assert.match(game, /yaw\+=dx\*\.0045/);
  assert.match(game, /pitch=clamp\(pitch-dy\*\.0037/);
  assert.match(game, /building-small-a\.glb/);
  assert.match(game, /new THREE\.CanvasTexture\(c\)/);
});

test('migrated gameplay dock is loaded without replacing the Three.js runtime', () => {
  assert.match(html, /class="gameDock"/);
  assert.match(html, /id="gamePanel"/);
  assert.match(html, /game\.js\?v=7/);
  assert.match(game, /createGameUI/);
  assert.match(game, /new THREE\.WebGLRenderer/);
  assert.match(game, /saveGameState/);
});

test('four persistent premade Greyfen services route walking into migrated systems', () => {
  assert.match(html, /id="worldServices"/);
  for (const id of ['forge', 'smelter', 'market', 'inn']) {
    assert.match(game, new RegExp(`id:'${id}'`));
  }
  assert.match(game, /building-small-d\.glb/);
  assert.match(game, /building-garage\.glb/);
  assert.match(game, /setServiceTarget/);
  assert.match(game, /gameUI\.open\(service\.tab\)/);
  assert.match(game, /syncTownServices/);
});

test('continuous overworld paints long routes and places complete landmark assets', () => {
  assert.match(html, /World map/);
  assert.match(game, /WORLD_ROUTES/);
  assert.match(game, /route\.points\.map/);
  assert.match(game, /R\.k==='world'/);
  assert.match(game, /landmark\.building/);
  assert.match(game, /setLandmarkTarget/);
  assert.match(game, /Math\.abs\(x\)>WORLD_LIMIT/);
});

test('3D travel checkpoints positions and starts preserved distance encounters', () => {
  assert.match(game, /readHostedWorldPosition/);
  assert.match(game, /writeHostedWorldPosition/);
  assert.match(game, /registerTravelDistance/);
  assert.match(game, /travelled\/9/);
  assert.match(game, /checkpoint 3D world position/);
  assert.match(game, /gameUI\.startEncounter\(\{boss:true/);
  assert.match(game, /return to Greyfen after defeat/);
});

test('world map supports walking targets and gated fast travel', () => {
  assert.match(html, /id="mapDestinations"/);
  assert.match(html, /Tap a landmark to walk/);
  assert.match(game, /getFastTravelLandmarks/);
  assert.match(game, /function fastTravelTo/);
  assert.match(game, /planCanvas\.addEventListener\('click',mapWalkTarget\)/);
  assert.match(game, /window\.EmberfallWorld/);
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
});
