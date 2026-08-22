import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESIDENT_BY_ID,
  TOWN_DAY_SECONDS,
  TOWN_RESIDENTS,
  getResidentDialogue,
  getResidentPlan,
  getTownClock
} from '../town-simulation.js';

test('town population gives every resident a stable identity, home, work, and full-day schedule', () => {
  assert.equal(TOWN_RESIDENTS.length >= 18, true);
  assert.equal(new Set(TOWN_RESIDENTS.map(resident => resident.id)).size, TOWN_RESIDENTS.length);
  for (const resident of TOWN_RESIDENTS) {
    assert.equal(Boolean(resident.name && resident.role && resident.work), true);
    assert.equal(resident.home.length, 2);
    assert.equal(resident.schedule[0].at, 0);
    assert.equal(resident.schedule.some(stop => stop.anchor === 'home'), true);
    assert.equal(resident.schedule.some(stop => stop.social), true);
  }
});

test('eight-minute town clock covers a readable 24-hour day', () => {
  assert.equal(getTownClock(0).label, '00:00');
  assert.equal(getTownClock(TOWN_DAY_SECONDS / 4).label, '06:00');
  assert.equal(getTownClock(TOWN_DAY_SECONDS / 2).label, '12:00');
  assert.equal(getTownClock(TOWN_DAY_SECONDS * .75).phase, 'Evening');
});

test('resident schedules move between authored anchors and settle into social time', () => {
  const mara = RESIDENT_BY_ID.get('mara');
  const working = getResidentPlan(mara, 600);
  assert.equal(working.from, 'work');
  assert.equal(working.activity, 'Working');
  const walking = getResidentPlan(mara, 710);
  assert.equal(walking.moving, true);
  assert.equal(walking.to, 'market');
  const social = getResidentPlan(mara, 1050);
  assert.equal(social.social, true);
});

test('dialogue becomes mission-aware without erasing each resident’s normal lines', () => {
  assert.match(getResidentDialogue('mara', 'find-mine', 600).line, /east of the fountain/);
  assert.doesNotMatch(getResidentDialogue('oren', 'find-mine', 600).line, /east of the fountain/);
  assert.equal(getResidentDialogue('missing', 'find-mine', 600), null);
});
