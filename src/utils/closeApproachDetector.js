import * as satellite from 'satellite.js';

const EARTH_RADIUS_KM = 6371;

// propagate a satrec to a Date and return ECI pos/vel, null on failure
function propagateEci(satrec, date) {
  try {
    const posVel = satellite.propagate(satrec, date);
    if (!posVel.position || typeof posVel.position !== 'object') return null;
    return posVel;
  } catch {
    return null;
  }
}

// compute ECI distance (km) between two satrecs at a given date, null on failure
export function computeDistance(satrec1, satrec2, date) {
  const pv1 = propagateEci(satrec1, date);
  const pv2 = propagateEci(satrec2, date);
  if (!pv1 || !pv2) return null;

  const dx = pv1.position.x - pv2.position.x;
  const dy = pv1.position.y - pv2.position.y;
  const dz = pv1.position.z - pv2.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// compute relative vel (km/s) between two satrecs at a given date, null on failure
export function computeRelativeVelocity(satrec1, satrec2, date) {
  const pv1 = propagateEci(satrec1, date);
  const pv2 = propagateEci(satrec2, date);
  if (!pv1 || !pv2) return null;
  if (!pv1.velocity || !pv2.velocity) return null;

  const dvx = pv1.velocity.x - pv2.velocity.x;
  const dvy = pv1.velocity.y - pv2.velocity.y;
  const dvz = pv1.velocity.z - pv2.velocity.z;
  return Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
}

// pre-filter candidates by orbital param overlap, removes sats whose orbits can't come within thresholdKm
export function preFilterCandidates(referenceSat, allSatellites, thresholdKm = 50) {
  const refSatrec = referenceSat.satrec;
  if (!refSatrec) return [];

  // orbital params from satrec (altp/alta in earth radii)
  const refPerigee = refSatrec.altp * EARTH_RADIUS_KM;
  const refApogee = refSatrec.alta * EARTH_RADIUS_KM;
  const refInclination = refSatrec.inclo; // radians

  const isRefLeo = refPerigee < 2000;
  const candidates = [];

  const satellites = allSatellites instanceof Map
    ? allSatellites.values()
    : allSatellites;

  for (const sat of satellites) {
    // skip self
    if (sat.id === referenceSat.id) continue;
    if (!sat.satrec) continue;

    const candPerigee = sat.satrec.altp * EARTH_RADIUS_KM;
    const candApogee = sat.satrec.alta * EARTH_RADIUS_KM;

    // alt overlap test: orbits must overlap within threshold
    if (candPerigee > refApogee + thresholdKm) continue;
    if (candApogee < refPerigee - thresholdKm) continue;

    // inclination filter for LEO sats
    const isCandLeo = candPerigee < 2000;
    if (isRefLeo && isCandLeo) {
      const incDiff = Math.abs(sat.satrec.inclo - refInclination);
      // 10deg in radians ~0.1745
      if (incDiff > 0.1745) continue;
    }

    candidates.push(sat);
  }

  return candidates;
}

// find close approaches between a ref sat and candidates
// two-phase scan: 60s coarse then 1s fine refinement
export function findCloseApproaches(referenceSatrec, candidates, options = {}) {
  const {
    thresholdKm = 50,
    scanHours = 24,
    startTime = Date.now(),
    onProgress = null,
  } = options;

  const startMs = startTime;
  const endMs = startMs + scanHours * 3600000;
  const coarseStepMs = 60000; // 60s
  const fineStepMs = 1000; // 1s
  const fineWindowMs = 120000; // +/- 2min

  const results = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    if (!cand.satrec) continue;

    // report progress every 10%
    if (onProgress && candidates.length > 0) {
      const percent = Math.floor((i / candidates.length) * 100);
      if (i % Math.max(1, Math.floor(candidates.length / 10)) === 0) {
        onProgress(percent);
      }
    }

    // phase 1: coarse scan at 60s intervals
    let minDist = Infinity;
    let minTime = startMs;

    for (let t = startMs; t <= endMs; t += coarseStepMs) {
      const date = new Date(t);
      const dist = computeDistance(referenceSatrec, cand.satrec, date);
      if (dist !== null && dist < minDist) {
        minDist = dist;
        minTime = t;
      }
    }

    // only refine if within threshold
    if (minDist > thresholdKm) continue;

    // phase 2: fine refinement +/- 2min at 1s steps
    const fineStart = Math.max(startMs, minTime - fineWindowMs);
    const fineEnd = Math.min(endMs, minTime + fineWindowMs);

    for (let t = fineStart; t <= fineEnd; t += fineStepMs) {
      const date = new Date(t);
      const dist = computeDistance(referenceSatrec, cand.satrec, date);
      if (dist !== null && dist < minDist) {
        minDist = dist;
        minTime = t;
      }
    }

    // compute relative vel at closest approach
    const approachDate = new Date(minTime);
    const relVel = computeRelativeVelocity(referenceSatrec, cand.satrec, approachDate);

    // get ECI positions at closest approach for viz
    const refPv = propagateEci(referenceSatrec, approachDate);
    const candPv = propagateEci(cand.satrec, approachDate);

    results.push({
      satelliteId: cand.id,
      name: cand.name || `NORAD ${cand.id}`,
      distanceKm: minDist,
      time: minTime,
      relativeVelocityKmS: relVel,
      refPositionEci: refPv ? refPv.position : null,
      candPositionEci: candPv ? candPv.position : null,
    });
  }

  // sort by distance (closest first)
  results.sort((a, b) => a.distanceKm - b.distanceKm);

  if (onProgress) onProgress(100);

  return results;
}
