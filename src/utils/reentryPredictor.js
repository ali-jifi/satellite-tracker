// re-entry prediction from TLE decay params
// uses satrec ndot/bstar/alta/altp to estimate re-entry windows

const EARTH_RADIUS_KM = 6371;

// convert Julian Date to ms since unix epoch
function jdayToMs(jd) {
  return (jd - 2440587.5) * 86400000;
}

// estimate re-entry time for a single sat, returns prediction obj or null if n/a
export function estimateReentryTime(sat) {
  if (!sat || !sat.satrec) return null;

  const { satrec } = sat;
  const { altp, ndot, bstar, no, jdsatepoch } = satrec;

  // perigee alt in km (altp is in earth radii)
  const perigeeKm = altp * EARTH_RADIUS_KM;

  // mean motion in rev/day
  const meanMotionRevDay = no * 1440 / (2 * Math.PI);

  // filter: skip high-orbit or negligible-drag sats
  if (perigeeKm > 600 || Math.abs(ndot) < 1e-7) return null;

  // target mean motion ~16.4 rev/day = ~120km alt (re-entry imminent)
  const targetRevDay = 16.4;

  // skip if already past target (already re-entering or decayed)
  if (meanMotionRevDay >= targetRevDay) return null;

  // ndot in TLE is half the actual first derivative
  const actualNdot = 2 * ndot;

  // skip if not decaying (mean motion not increasing)
  if (actualNdot <= 0) return null;

  // linear extrapolation: days until mean motion reaches target
  const daysToReentry = (targetRevDay - meanMotionRevDay) / actualNdot;

  // epoch in ms
  const epochMs = jdayToMs(jdsatepoch);
  const predictedMs = epochMs + daysToReentry * 86400000;

  // epoch age for uncertainty calc
  const epochAgeDays = (Date.now() - epochMs) / 86400000;

  // uncertainty grows w/ extrapolation distance and epoch staleness
  const uncertaintyDays = Math.max(1, daysToReentry * 0.1 + epochAgeDays * 0.5);

  // confidence based on epoch freshness
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

// scan all sats for re-entry predictions, returns sorted array (soonest first)
export function scanAllReentries(satelliteArray) {
  if (!satelliteArray || satelliteArray.length === 0) return [];

  const results = [];
  for (let i = 0; i < satelliteArray.length; i++) {
    const prediction = estimateReentryTime(satelliteArray[i]);
    if (prediction) {
      results.push(prediction);
    }
  }

  // sort by predicted date asc (soonest first)
  results.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());

  return results;
}
