// Short spatial briefings shown when a mission introduces a new place.
// Points are resolved by the Three.js runtime so this data stays testable and
// independent from rendering or save code.

const briefing = (chapter, title, text, points) => Object.freeze({
  chapter,
  title,
  text,
  points: Object.freeze(points.map(point => Object.freeze(point)))
});

export const MISSION_BRIEFINGS = Object.freeze({
  'find-mine': briefing('GREYFEN ORIENTATION', 'The Iron Mouth', 'Greyfen begins at its town mine. Follow the eastern lane beyond the fountain.', [
    { serviceId: 'mine', caption: 'Town mine · gather iron ore' }
  ]),
  'find-smelter': briefing('GREYFEN ORIENTATION', 'Ore needs fire', 'The old smelter stands between the mine road and the central square.', [
    { serviceId: 'mine', caption: 'Ore starts here' },
    { serviceId: 'smelter', caption: 'Smelter · refine ore into bars' }
  ]),
  'find-forge': briefing('GREYFEN ORIENTATION', 'The smithy', 'Carry finished bars west of the fountain. Pell can turn them into equipment and combat cards.', [
    { serviceId: 'smelter', caption: 'Collect finished bars' },
    { serviceId: 'forge', caption: 'Smithy · forge your first weapon' }
  ]),
  'find-market': briefing('GREYFEN ORIENTATION', 'The market hall', 'The north side of the square buys spare materials and old equipment.', [
    { serviceId: 'market', caption: 'Market · sell surplus goods' }
  ]),
  'visit-frostmere': briefing('THE NORTH ROAD', 'Frostmere calls', 'Leave Greyfen by the north road and follow the mountain route to the northern hold.', [
    { landmarkId: 'frostmere', caption: 'Frostmere · better northern facilities' }
  ]),
  'restore-inn': briefing('RESTORE GREYFEN', 'The Wayfarer Inn', 'Reopening the inn gives every future expedition a stronger start.', [
    { serviceId: 'inn', caption: 'Wayfarer Inn · permanent expedition health' }
  ]),
  'prepare-lower-ways': briefing('SECURE DEEPSTEEL', 'Prepare for the dark', 'The Lower Ways punish an unprepared traveller. Forge and equip at least six defence first.', [
    { serviceId: 'forge', caption: 'Smithy · forge iron expedition armour' }
  ]),
  'enter-lower-ways': briefing('SECURE DEEPSTEEL', 'The Lower Ways', 'The southeastern road ends at a buried maze. Find its guardian to reopen Deepsteel.', [
    { landmarkId: 'cave', caption: 'Lower Ways · maze expedition' }
  ]),
  'patrol-forest': briefing('THE WILD ROAD', 'Whisperwood', 'Three successful patrols reveal the guardian holding the western road.', [
    { landmarkId: 'forest', caption: 'Whisperwood · patrol the wild road' }
  ]),
  'visit-sunspire': briefing('REUNITE EMBERFALL', 'The eastern charter', 'Beyond Whisperwood, the eastern road climbs toward Sunspire and its glass foundries.', [
    { landmarkId: 'sunspire', caption: 'Sunspire · the Glass Veins' }
  ]),
  'reach-starsilver-mine': briefing('DESCEND DEEPER', 'The Glass Veins', 'Return to Sunspire. Its warden guards the path to Star-silver.', [
    { landmarkId: 'sunspire', caption: 'Sunspire Glass Mine' }
  ]),
  'visit-tidewatch': briefing('REUNITE EMBERFALL', 'Road to the coast', 'The southeast road follows the old shore route to Tidewatch.', [
    { landmarkId: 'tidewatch', caption: 'Tidewatch · coastal refuge' }
  ]),
  'reach-aetherite-mine': briefing('DESCEND DEEPER', 'The Buried Sky', 'Tidewatch’s deepest mine holds Emberfall’s final metal beneath the coast.', [
    { landmarkId: 'tidewatch', caption: 'Tidewatch Buried Mine' }
  ])
});

export function getMissionBriefing(objectiveId) {
  return MISSION_BRIEFINGS[objectiveId] || null;
}
