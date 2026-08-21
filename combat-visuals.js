// DOM silhouettes keep combat animated on low-end phones without adding another
// WebGL context. Enemy IDs come exclusively from the canonical combat catalog.

const FIGURES = Object.freeze({
  scavenger: `
    <i class="enemyPart scavengerCloak"></i><i class="enemyPart scavengerBody"></i>
    <i class="enemyPart scavengerHood"></i><i class="enemyPart scavengerFace"></i><i class="enemyPart scavengerEye eyeLeft"></i><i class="enemyPart scavengerEye eyeRight"></i>
    <i class="enemyPart limb arm armLeft"></i><i class="enemyPart limb arm armRight"></i><i class="enemyPart scavengerBlade"></i>
    <i class="enemyPart limb leg legLeft"></i><i class="enemyPart limb leg legRight"></i>`,
  crawler: `
    <i class="enemyPart crawlerBody"></i><i class="enemyPart crawlerHead"></i><i class="enemyPart crawlerCore"></i>
    <i class="enemyPart crawlerShard shardOne"></i><i class="enemyPart crawlerShard shardTwo"></i><i class="enemyPart crawlerShard shardThree"></i>
    <i class="enemyPart crawlerLeg legOne"></i><i class="enemyPart crawlerLeg legTwo"></i><i class="enemyPart crawlerLeg legThree"></i><i class="enemyPart crawlerLeg legFour"></i>
    <i class="enemyPart crawlerLeg legFive"></i><i class="enemyPart crawlerLeg legSix"></i>`,
  stonehorn: `
    <i class="enemyPart stoneBody"></i><i class="enemyPart stonePlate plateOne"></i><i class="enemyPart stonePlate plateTwo"></i>
    <i class="enemyPart stoneHead"></i><i class="enemyPart stoneHorn hornLeft"></i><i class="enemyPart stoneHorn hornRight"></i><i class="enemyPart stoneEye"></i>
    <i class="enemyPart stoneLeg stoneLegOne"></i><i class="enemyPart stoneLeg stoneLegTwo"></i><i class="enemyPart stoneLeg stoneLegThree"></i><i class="enemyPart stoneLeg stoneLegFour"></i>`,
  custodian: `
    <i class="enemyPart custodianCape"></i><i class="enemyPart custodianTorso"></i><i class="enemyPart custodianCore"></i>
    <i class="enemyPart custodianHead"></i><i class="enemyPart custodianCrown crownLeft"></i><i class="enemyPart custodianCrown crownRight"></i>
    <i class="enemyPart custodianArm custodianArmLeft"></i><i class="enemyPart custodianArm custodianArmRight"></i>
    <i class="enemyPart custodianHammerHead"></i><i class="enemyPart custodianHammerGrip"></i>
    <i class="enemyPart custodianLeg custodianLegLeft"></i><i class="enemyPart custodianLeg custodianLegRight"></i>`,
  tunnelmauler: `
    <i class="enemyPart maulerBody"></i><i class="enemyPart maulerBack"></i><i class="enemyPart maulerPlate plateA"></i><i class="enemyPart maulerPlate plateB"></i><i class="enemyPart maulerPlate plateC"></i>
    <i class="enemyPart maulerHead"></i><i class="enemyPart maulerJaw"></i><i class="enemyPart maulerEye"></i><i class="enemyPart maulerClaw clawLeft"></i><i class="enemyPart maulerClaw clawRight"></i>
    <i class="enemyPart maulerLeg maulerLegA"></i><i class="enemyPart maulerLeg maulerLegB"></i><i class="enemyPart maulerLeg maulerLegC"></i><i class="enemyPart maulerLeg maulerLegD"></i>`,
  glasswarden: `
    <i class="enemyPart glassAura"></i><i class="enemyPart glassTorso"></i><i class="enemyPart glassCore"></i><i class="enemyPart glassHead"></i>
    <i class="enemyPart glassShard glassCrownA"></i><i class="enemyPart glassShard glassCrownB"></i><i class="enemyPart glassShard glassShoulderA"></i><i class="enemyPart glassShard glassShoulderB"></i>
    <i class="enemyPart glassArm glassArmA"></i><i class="enemyPart glassArm glassArmB"></i><i class="enemyPart glassLeg glassLegA"></i><i class="enemyPart glassLeg glassLegB"></i>`,
  abysssentinel: `
    <i class="enemyPart abyssHalo"></i><i class="enemyPart abyssCape"></i><i class="enemyPart abyssTorso"></i><i class="enemyPart abyssCore"></i><i class="enemyPart abyssHead"></i>
    <i class="enemyPart abyssHorn abyssHornA"></i><i class="enemyPart abyssHorn abyssHornB"></i><i class="enemyPart abyssArm abyssArmA"></i><i class="enemyPart abyssArm abyssArmB"></i>
    <i class="enemyPart abyssShard abyssShardA"></i><i class="enemyPart abyssShard abyssShardB"></i><i class="enemyPart abyssShard abyssShardC"></i>`
});

const CARD_ART = Object.freeze({
  slash: ['attack', '╱'],
  splitter: ['breaker', '✣'],
  guard: ['guard', '⬒'],
  feint: ['utility', '↝'],
  heavy: ['attack', '┃'],
  brace: ['guard', '▣'],
  measured: ['attack', '†'],
  driving: ['breaker', '↯'],
  sunder: ['breaker', '✣'],
  silvercut: ['silver', '☾'],
  aetherbreak: ['aether', '✦'],
  sidestep: ['utility', '➶'],
  deflect: ['guard', '◈'],
  shatter: ['breaker', '✹'],
  shieldbash: ['guard', '⬢'],
  hobble: ['utility', '⌁'],
  rally: ['guard', '♜'],
  exploit: ['attack', '⚡'],
  flurry: ['attack', '≋'],
  focus: ['utility', '◎'],
  bulwark: ['guard', '▰']
});

export function cardArtMarkup(cardId) {
  const [theme, glyph] = CARD_ART[cardId] || ['attack', '╱'];
  return `<span class="combatCardArt art-${cardId} theme-${theme}" aria-hidden="true"><i class="artHorizon"></i><i class="artFigure"></i><i class="artWeapon">${glyph}</i><i class="artBurst"></i></span>`;
}

export function combatSceneryMarkup(area = 'world') {
  const safeArea = ['world', 'forest', 'cave', 'town'].includes(area) ? area : 'world';
  return `<div class="combatScenery scenery-${safeArea}" aria-hidden="true"><i class="sceneMist mistA"></i><i class="sceneMist mistB"></i><i class="sceneMountain mountainA"></i><i class="sceneMountain mountainB"></i><i class="sceneTree treeA"></i><i class="sceneTree treeB"></i><i class="sceneTree treeC"></i><i class="sceneCrystal crystalA"></i><i class="sceneCrystal crystalB"></i><i class="sceneLantern lanternA"></i><i class="sceneLantern lanternB"></i><i class="sceneSpark sparkA"></i><i class="sceneSpark sparkB"></i><i class="sceneSpark sparkC"></i><i class="sceneSpark sparkD"></i><i class="sceneRoad"></i></div>`;
}

export function enemyFigureMarkup(enemyId, { boss = false, broken = false, effect = '' } = {}) {
  const id = Object.hasOwn(FIGURES, enemyId) ? enemyId : 'scavenger';
  const classes = ['combatEnemyModel', `enemy-${id}`];
  if (boss) classes.push('boss');
  if (broken) classes.push('is-broken');
  if (effect) classes.push(effect);
  return `<div class="${classes.join(' ')}" data-enemy-model="${id}"><i class="enemyShadow"></i><div class="enemyRoot">${FIGURES[id]}</div></div>`;
}

export function playerWeaponMarkup({ effect = '', defeated = false } = {}) {
  return `<div class="combatWeapon ${effect}${defeated ? ' is-defeated' : ''}" aria-hidden="true"><i class="weaponBlade"></i><i class="weaponGuard"></i><i class="weaponGrip"></i><i class="weaponHand"></i></div>`;
}
