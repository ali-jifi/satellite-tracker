/**
 * Re-entry prediction from TLE decay parameters.
 * Uses satrec ndot/bstar/alta/altp to estimate re-entry windows.
 */

const EARTH_RADIUS_KM = 6371;

/** Convert Julian Date to milliseconds since Unix epoch */
function jdayToMs(jd) {
  return (jd - 2440587.5) * 86400000;
}

/**
 * Estimate re-entry time for a single satellite.
 * Returns prediction object or null if not applicable.
 */
export function estimateReentryTime(sat) {
  if (!sat || !sat.satrec) return null;

  const { satrec } = sat;
  const { altp, ndot, bstar, no, jdsatepoch } = satrec;

  // Perigee altitude in km (altp is in Earth radii)
  const perigeeKm = altp * EARTH_RADIUS_KM;

  // Mean motion in rev/day
  const meanMotionRevDay = no * 1440 / (2 * Math.PI);

  // Filter: skip high-orbit or negligible-drag satellites
  if (perigeeKm > 600 || Math.abs(ndot) < 1e-7) return null;

  // Target mean motion ~16.4 rev/day corresponds to ~120km altitude (re-entry imminent)
  const targetRevDay = 16.4;

  // Skip if already past target (already re-entering or decayed)
  if (meanMotionRevDay >= targetRevDay) return null;

  // ndot in TLE is half the actual first derivative
  const actualNdot = 2 * ndot;

  // Skip if not decaying (mean motion not increasing)
  if (actualNdot <= 0) return null;

  // Linear extrapolation: days until mean motion reaches target
  const daysToReentry = (targetRevDay - meanMotionRevDay) / actualNdot;

  // Epoch in milliseconds
  const epochMs = jdayToMs(jdsatepoch);
  const predictedMs = epochMs + daysToReentry * 86400000;

  // Epoch age for uncertainty calculation
  const epochAgeDays = (Date.now() - epochMs) / 86400000;

  // Uncertainty grows with extrapolation distance and epoch staleness
  const uncertaintyDays = Math.max(1, daysToReentry * 0.1 + epochAgeDays * 0.5);

  // Confidence based on epoch freshness
  const confidence =
    epochAgeDays < 3 ? 'HIGH' : epochAgeDays < 7 ? 'MEDIUM' : 'LOW';

  return {
    satelliteId: sat.id,
    name: sat.name,
    predictedDate: new Date(predictedMs),
    uncertaintyDays,
    perigeeKm,
    bstar,
    epochAge: epochAgeDays,
    confidence,
  };
}

/**
 * Scan all satellites for re-entry predictions.
 * Returns sorted array (soonest re-entry first).
 */
export function scanAllReentries(satelliteArray) {
  if (!satelliteArray || satelliteArray.length === 0) return [];

  const results = [];
  for (let i = 0; i < satelliteArray.length; i++) {
    const prediction = estimateReentryTime(satelliteArray[i]);
    if (prediction) {
      results.push(prediction);
    }
  }

  // Sort by predicted date ascending (soonest first)
  results.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());

  return results;
}
