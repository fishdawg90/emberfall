// Renderer-independent town population data and daily schedule rules.
// One Emberfall day lasts eight real minutes so residents visibly change
// routines during a normal phone play session without frantic movement.

export const TOWN_DAY_SECONDS = 8 * 60;
export const TOWN_DAY_MINUTES = 24 * 60;
export const RESIDENT_TRAVEL_MINUTES = 32;

const freezeSchedule = entries => Object.freeze(entries.map(entry => Object.freeze(entry)));

const DAILY_SCHEDULES = Object.freeze({
  worker: freezeSchedule([
    { at: 0, anchor: 'home', activity: 'Sleeping' },
    { at: 390, anchor: 'square', activity: 'Starting the day' },
    { at: 450, anchor: 'work', activity: 'Working' },
    { at: 720, anchor: 'market', activity: 'Buying lunch' },
    { at: 790, anchor: 'work', activity: 'Working' },
    { at: 1030, anchor: 'square', activity: 'Talking with neighbours', social: true },
    { at: 1140, anchor: 'inn', activity: 'At the Wayfarer Inn', social: true },
    { at: 1260, anchor: 'home', activity: 'Home for the night' }
  ]),
  trader: freezeSchedule([
    { at: 0, anchor: 'home', activity: 'Sleeping' },
    { at: 410, anchor: 'market', activity: 'Opening the stalls' },
    { at: 690, anchor: 'square', activity: 'Trading news', social: true },
    { at: 760, anchor: 'market', activity: 'Working the market' },
    { at: 1010, anchor: 'square', activity: 'Closing the stalls' },
    { at: 1090, anchor: 'inn', activity: 'At the Wayfarer Inn', social: true },
    { at: 1240, anchor: 'home', activity: 'Home for the night' }
  ]),
  warden: freezeSchedule([
    { at: 0, anchor: 'home', activity: 'Sleeping' },
    { at: 360, anchor: 'gate', activity: 'Watching the boundary' },
    { at: 650, anchor: 'square', activity: 'Morning patrol' },
    { at: 720, anchor: 'gate', activity: 'Watching the road' },
    { at: 1010, anchor: 'square', activity: 'Evening patrol' },
    { at: 1110, anchor: 'inn', activity: 'Off duty', social: true },
    { at: 1260, anchor: 'home', activity: 'Home for the night' }
  ]),
  wanderer: freezeSchedule([
    { at: 0, anchor: 'home', activity: 'Sleeping' },
    { at: 420, anchor: 'square', activity: 'Greeting the town', social: true },
    { at: 540, anchor: 'work', activity: 'Making rounds' },
    { at: 760, anchor: 'market', activity: 'Running errands' },
    { at: 900, anchor: 'work', activity: 'Making rounds' },
    { at: 1050, anchor: 'square', activity: 'Sharing the day’s news', social: true },
    { at: 1160, anchor: 'inn', activity: 'At the Wayfarer Inn', social: true },
    { at: 1280, anchor: 'home', activity: 'Home for the night' }
  ])
});

const resident = (id, townId, name, role, work, home, appearance, lines, schedule = 'worker') => Object.freeze({
  id, townId, name, role, work, home: Object.freeze(home), appearance: Object.freeze(appearance),
  lines: Object.freeze(lines), schedule: DAILY_SCHEDULES[schedule]
});

export const TOWN_RESIDENTS = Object.freeze([
  resident('mara', 'town', 'Mara Vale', 'Mine foreman', 'mine', [-42, 22], { cloth: 0x77443a, accent: 0xc39155, hat: 'brim', height: 1.02 }, [
    'Iron Mouth is an old seam, but it still gives Greyfen a beginning.',
    'A good miner leaves enough timber between the dark and daylight.'
  ]),
  resident('oren', 'town', 'Oren Flint', 'Smelter keeper', 'smelter', [54, 18], { cloth: 0x485f59, accent: 0x9b6541, hat: 'cap', apron: true, height: 1.05 }, [
    'Ore is a promise. Heat and patience turn it into something useful.',
    'Frostmere’s furnaces can do things our old stack cannot.'
  ]),
  resident('pell', 'town', 'Pell Quill', 'Greyfen smith', 'forge', [-48, -8], { cloth: 0x4d506e, accent: 0xa66f3e, apron: true, beard: true, height: 1.08 }, [
    'Your equipment changes the cards you carry into a fight.',
    'Iron armour is heavy work, but the Lower Ways punish bare courage.'
  ]),
  resident('tess', 'town', 'Tess Lark', 'Market broker', 'market', [37, -43], { cloth: 0x7b4d39, accent: 0xe0b263, hair: 'bun', satchel: true, height: .98 }, [
    'Greyfen needs coin moving through it, not sleeping in a drawer.',
    'The first northern survey made our market feel connected again.'
  ], 'trader'),
  resident('edda', 'town', 'Edda Hearth', 'Innkeeper', 'inn', [-16, -60], { cloth: 0x3c675d, accent: 0xb97d4d, hair: 'bun', apron: true, height: 1.0 }, [
    'Restore one room and every expedition begins a little stronger.',
    'By evening, every road in Emberfall seems to end at my tables.'
  ], 'trader'),
  resident('bram', 'town', 'Bram Alder', 'South-gate warden', 'gate', [-18, 70], { cloth: 0x46536c, accent: 0x8a744d, hat: 'hood', pack: true, height: 1.12 }, [
    'Inside the boundary posts, you are safe. Beyond them, stay ready.',
    'The south road forks toward Whisperwood and the Lower Ways.'
  ], 'warden'),
  resident('nia', 'town', 'Nia Moss', 'Road courier', 'fountain', [18, 57], { cloth: 0x8a623e, accent: 0x3f6f64, hat: 'cap', pack: true, height: .96 }, [
    'Pin a mission and I can help put the route under your map.',
    'People remember a road once someone has carried news along it.'
  ], 'wanderer'),
  resident('fen', 'town', 'Fen Ash', 'Lamplighter', 'lamps', [61, -10], { cloth: 0x384f5d, accent: 0xe0a850, hat: 'tall', satchel: true, height: 1.04 }, [
    'I light the square first and the boundary last.',
    'A lit road feels shorter, even when it is not.'
  ], 'wanderer'),
  resident('jun', 'town', 'Jun Reed', 'Town gardener', 'fountain', [-63, 43], { cloth: 0x55704d, accent: 0xbd934b, hat: 'brim', height: .93 }, [
    'A few benches and planted corners make ruins feel like a town again.',
    'The fountain tells me when Greyfen has remembered how to breathe.'
  ], 'wanderer'),
  resident('yrsa', 'frostmere', 'Yrsa Snow', 'Foundry master', 'foundry', [-10, 15], { cloth: 0x496d7d, accent: 0xc2d7dc, hat: 'hood', apron: true, height: 1.06 }, ['Our flooded ore needs a colder, steadier furnace.']),
  resident('hale', 'frostmere', 'Hale Rime', 'Northern scout', 'gate', [15, -11], { cloth: 0x697f87, accent: 0x40556c, pack: true, height: 1.1 }, ['The north road is quiet only when someone is watching it.'], 'warden'),
  resident('nim', 'frostmere', 'Nim Coil', 'Mechanist', 'square', [-17, -9], { cloth: 0x405267, accent: 0x84a9b4, hat: 'cap', satchel: true, height: .94 }, ['Frostmere’s pumps keep the Deepsteel galleries from swallowing themselves.'], 'wanderer'),
  resident('cassia', 'sunspire', 'Cassia Dawn', 'Charter keeper', 'square', [-12, 12], { cloth: 0x9c5d37, accent: 0xe2b867, hair: 'bun', height: 1.02 }, ['Sunspire remembers every charter—even the roads that vanished.'], 'trader'),
  resident('rook', 'sunspire', 'Rook Ember', 'Glass smelter', 'foundry', [15, 10], { cloth: 0x75543b, accent: 0xca7b42, apron: true, beard: true, height: 1.12 }, ['Black glass shows every careless strike.']),
  resident('venn', 'sunspire', 'Venn Ray', 'Road reader', 'gate', [9, -15], { cloth: 0x674d47, accent: 0xe2a55a, hat: 'brim', pack: true, height: .98 }, ['The coastal road starts where the morning light meets the eastern stones.'], 'wanderer'),
  resident('mira', 'tidewatch', 'Mira Wake', 'Tide keeper', 'square', [-13, 8], { cloth: 0x286d73, accent: 0x8dc8c0, hair: 'bun', height: 1.0 }, ['The mine beneath us opens onto a sky that cannot be above us.'], 'trader'),
  resident('cor', 'tidewatch', 'Cor Brine', 'Sea smelter', 'foundry', [14, 8], { cloth: 0x425d70, accent: 0x57a2a0, apron: true, hat: 'cap', height: 1.08 }, ['Salt air changes the heat. We learned to use it.']),
  resident('sella', 'tidewatch', 'Sella Gull', 'Coast runner', 'gate', [2, -16], { cloth: 0x365e58, accent: 0xd2b060, pack: true, hat: 'brim', height: .95 }, ['The boundary lanterns are the last safe lights before the shore.'], 'wanderer')
]);

export const RESIDENT_BY_ID = new Map(TOWN_RESIDENTS.map(entry => [entry.id, entry]));

const MISSION_TIPS = Object.freeze({
  'find-mine': Object.freeze({ resident: 'mara', line: 'My mine is east of the fountain. Follow the gold route and listen for the rails.' }),
  'find-smelter': Object.freeze({ resident: 'oren', line: 'Bring your ore to the furnace beside the eastern mine road.' }),
  'find-forge': Object.freeze({ resident: 'pell', line: 'The smithy is west of the square. Bring three bars for a first sword.' }),
  'find-market': Object.freeze({ resident: 'tess', line: 'The market hall faces the north side of the square.' }),
  'visit-frostmere': Object.freeze({ resident: 'nia', line: 'Take the north gate. The road bends west beneath the mountains to Frostmere.' }),
  'restore-inn': Object.freeze({ resident: 'edda', line: 'Restore one room and I can prepare every expedition properly.' }),
  'prepare-lower-ways': Object.freeze({ resident: 'pell', line: 'Six points of equipped defence is the least I would carry into the Lower Ways.' }),
  'enter-lower-ways': Object.freeze({ resident: 'bram', line: 'Leave by the south gate, then follow the southeastern road to the broken rock gate.' }),
  'explore-lower-ways': Object.freeze({ resident: 'bram', line: 'The deepest path is rarely the straightest. Mark junctions and save Embermoss for when you are hurt.' }),
  'patrol-forest': Object.freeze({ resident: 'bram', line: 'Whisperwood lies beyond the western boundary. Three clear patrols should draw out its guardian.' }),
  'visit-sunspire': Object.freeze({ resident: 'nia', line: 'The eastern road opens beyond Whisperwood and climbs toward Sunspire’s bright roofs.' }),
  'reach-starsilver-mine': Object.freeze({ resident: 'cassia', line: 'Rook keeps the Glass Veins charter. Find him near Sunspire’s foundry.' }),
  'gate-starsilver': Object.freeze({ resident: 'rook', line: 'The Glass Warden reads hesitation like a flaw in crystal. Bring a deck built to Break it.' }),
  'visit-tidewatch': Object.freeze({ resident: 'nia', line: 'Take the southeast road from the Lower Ways fork. The coast lights lead into Tidewatch.' }),
  'reach-aetherite-mine': Object.freeze({ resident: 'mira', line: 'The Buried Mine is beneath Tidewatch. Cor knows how its strange ore answers heat.' }),
  'gate-aetherite': Object.freeze({ resident: 'cor', line: 'Aetherite bends the furnace light. The sentinel below bends steel just as easily.' })
});

export const SOCIAL_LINES = Object.freeze([
  'Did you hear? The northern road is open again.',
  'The market lamps stayed lit all night.',
  'Someone should check the boundary posts before dusk.',
  'Edda says the inn roof will hold through winter.',
  'Greyfen sounds different when the smithy is working.'
]);

export function getTownClock(elapsedSeconds = Date.now() / 1000) {
  const fraction = ((elapsedSeconds % TOWN_DAY_SECONDS) + TOWN_DAY_SECONDS) % TOWN_DAY_SECONDS / TOWN_DAY_SECONDS;
  const minute = Math.floor(fraction * TOWN_DAY_MINUTES);
  const hour = Math.floor(minute / 60);
  return {
    minute,
    hour,
    label: `${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
    phase: hour < 6 ? 'Night' : hour < 11 ? 'Morning' : hour < 17 ? 'Day' : hour < 21 ? 'Evening' : 'Night'
  };
}

function scheduleIndex(schedule, minute) {
  let index = schedule.length - 1;
  for (let cursor = 0; cursor < schedule.length; cursor += 1) {
    if (schedule[cursor].at <= minute) index = cursor;
    else break;
  }
  return index;
}

export function getResidentPlan(residentOrId, minute) {
  const residentEntry = typeof residentOrId === 'string' ? RESIDENT_BY_ID.get(residentOrId) : residentOrId;
  if (!residentEntry) return null;
  const currentMinute = ((Number(minute) || 0) % TOWN_DAY_MINUTES + TOWN_DAY_MINUTES) % TOWN_DAY_MINUTES;
  const schedule = residentEntry.schedule;
  const index = scheduleIndex(schedule, currentMinute);
  const current = schedule[index];
  const next = schedule[(index + 1) % schedule.length];
  const nextAt = index === schedule.length - 1 ? next.at + TOWN_DAY_MINUTES : next.at;
  const adjustedMinute = index === schedule.length - 1 && currentMinute < current.at ? currentMinute + TOWN_DAY_MINUTES : currentMinute;
  const travelStart = nextAt - RESIDENT_TRAVEL_MINUTES;
  const travelling = adjustedMinute >= travelStart;
  const progress = travelling ? Math.min(1, Math.max(0, (adjustedMinute - travelStart) / RESIDENT_TRAVEL_MINUTES)) : 0;
  return {
    resident: residentEntry,
    from: current.anchor,
    to: next.anchor,
    progress,
    moving: travelling,
    activity: travelling ? `Walking to ${next.anchor}` : current.activity,
    social: !travelling && Boolean(current.social),
    scheduleIndex: index
  };
}

export function getResidentDialogue(residentOrId, objectiveId, minute) {
  const residentEntry = typeof residentOrId === 'string' ? RESIDENT_BY_ID.get(residentOrId) : residentOrId;
  if (!residentEntry) return null;
  const tip = MISSION_TIPS[objectiveId];
  const plan = getResidentPlan(residentEntry, minute);
  const line = tip?.resident === residentEntry.id
    ? tip.line
    : residentEntry.lines[(Math.floor((Number(minute) || 0) / 180) + residentEntry.id.length) % residentEntry.lines.length];
  return { ...residentEntry, line, activity: plan?.activity || 'In town', social: plan?.social || false };
}
