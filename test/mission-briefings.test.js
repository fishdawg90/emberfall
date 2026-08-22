import test from 'node:test';
import assert from 'node:assert/strict';
import { getMissionBriefing, MISSION_BRIEFINGS } from '../mission-briefings.js';

test('spatial briefings cover Greyfen orientation and major journeys', () => {
  for (const id of ['find-mine', 'find-smelter', 'find-forge', 'find-market', 'visit-frostmere', 'enter-lower-ways', 'patrol-forest', 'visit-sunspire', 'visit-tidewatch']) {
    const entry = getMissionBriefing(id);
    assert.ok(entry, `${id} should have a briefing`);
    assert.ok(entry.title.length > 3);
    assert.ok(entry.points.length >= 1);
  }
});

test('briefing points resolve to service or landmark targets', () => {
  for (const entry of Object.values(MISSION_BRIEFINGS)) {
    for (const point of entry.points) {
      assert.equal(Boolean(point.serviceId) !== Boolean(point.landmarkId), true);
      assert.ok(point.caption);
    }
  }
  assert.equal(getMissionBriefing('first-ore'), null);
});
