// Small, renderer-independent helpers for comfortable mobile route following.

export function routeHeading(from, to) {
  const dx = (Number(to?.x) || 0) - (Number(from?.x) || 0);
  const dz = (Number(to?.z) || 0) - (Number(from?.z) || 0);
  if (Math.hypot(dx, dz) < 0.0001) return null;
  return Math.atan2(dx, -dz);
}

export function routeDestinationReached(position, destination, tolerance = 1.15) {
  if (!position || !destination) return false;
  return Math.hypot(
    (Number(destination.x) || 0) - (Number(position.x) || 0),
    (Number(destination.z) || 0) - (Number(position.z) || 0)
  ) <= Math.max(.25, Number(tolerance) || 1.15);
}

export function dampAngle(current, target, responsiveness, deltaTime) {
  const turn = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const amount = 1 - Math.exp(-Math.max(0, responsiveness) * Math.max(0, deltaTime));
  return current + turn * amount;
}

export function segmentIsClear(from, to, isBlocked, spacing = 1.2) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(distance / Math.max(.25, spacing)));
  for (let step = 1; step < steps; step += 1) {
    const amount = step / steps;
    if (isBlocked(from.x + (to.x - from.x) * amount, from.z + (to.z - from.z) * amount)) return false;
  }
  return true;
}

export function smoothNavigationPath(path, isBlocked, options = {}) {
  if (!Array.isArray(path) || path.length < 3) return Array.isArray(path) ? [...path] : [];
  const sampleSpacing = options.sampleSpacing || 1.2;
  const maxSkip = Math.max(2, Math.floor(options.maxSkip || 7));
  const result = [path[0]];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = Math.min(path.length - 1, anchor + maxSkip);
    while (next > anchor + 1 && !segmentIsClear(path[anchor], path[next], isBlocked, sampleSpacing)) next -= 1;
    result.push(path[next]);
    anchor = next;
  }
  return result;
}

export function routeLookAhead(position, path, startIndex = 0, distance = 12) {
  if (!Array.isArray(path) || !path.length) return null;
  let from = { x: position.x, z: position.z };
  let remaining = Math.max(0, distance);
  for (let index = Math.max(0, startIndex); index < path.length; index += 1) {
    const point = path[index];
    const length = Math.hypot(point.x - from.x, point.z - from.z);
    if (length >= remaining && length > 0) {
      const amount = remaining / length;
      return { x: from.x + (point.x - from.x) * amount, z: from.z + (point.z - from.z) * amount };
    }
    remaining -= length;
    from = point;
  }
  return path.at(-1);
}
