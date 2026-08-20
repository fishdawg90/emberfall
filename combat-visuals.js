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
    <i class="enemyPart custodianLeg custodianLegLeft"></i><i class="enemyPart custodianLeg custodianLegRight"></i>`
});

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
