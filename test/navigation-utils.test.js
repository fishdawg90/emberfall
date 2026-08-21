import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dampAngle,
  routeHeading,
  routeLookAhead,
  smoothNavigationPath
} from '../navigation-utils.js';

test('saw-tooth diagonal routes collapse into long clear segments', () => {
  const path = [
    { x: 0, z: 0 }, { x: 7, z: 0 }, { x: 7, z: 7 }, { x: 14, z: 7 },
    { x: 14, z: 14 }, { x: 21, z: 14 }, { x: 21, z: 21 }
  ];
  const smoothed = smoothNavigationPath(path, () => false, { maxSkip: 7 });
  assert.deepEqual(smoothed, [path[0], path.at(-1)]);
});

test('route smoothing retains a waypoint when the direct diagonal is blocked', () => {
  const path = [{ x: 0, z: 0 }, { x: 0, z: 7 }, { x: 7, z: 7 }, { x: 14, z: 7 }];
  const blocked = (x, z) => x > 2 && x < 6 && z < 5;
  const smoothed = smoothNavigationPath(path, blocked, { maxSkip: 7, sampleSpacing: .4 });
  assert.equal(smoothed.length >= 3, true);
  assert.deepEqual(smoothed.at(-1), path.at(-1));
});

test('look-ahead heading faces travel and angle damping takes the shortest turn', () => {
  const path = [{ x: 0, z: 0 }, { x: 0, z: -5 }, { x: 10, z: -5 }];
  const look = routeLookAhead({ x: 0, z: 0 }, path, 1, 8);
  assert.deepEqual(look, { x: 3, z: -5 });
  assert.equal(routeHeading({ x: 0, z: 0 }, { x: 0, z: -5 }), 0);
  const turned = dampAngle(Math.PI - .1, -Math.PI + .1, 12, .1);
  assert.equal(turned > Math.PI - .1, true);
});
