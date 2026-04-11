// TLE health metrics and orbital element extraction from satrec

import { estimateReentryTime } from './reentryPredictor';

const EARTH_RADIUS_KM = 6371;
const GM = 398600.4418; // km^3/s^2
const RAD2DEG = 180 / Math.PI;

// convert Julian Date to ms since unix epoch
function jdayToMs(jd) {
  return (jd - 2440587.5) * 86400000;
}

// analyze a sat's TLE data, extracting orbital elements, health metrics, and derived params
// returns null if sat has no satrec
export function analyzeTle(satellite) {
  if (!satellite || !satellite.satrec) return null;

  const { satrec } = satellite;

  // mean motion in rev/day
  const meanMotionRevDay = satrec.no * 1440 / (2 * Math.PI);

  // semi-major axis from mean motion
  // n (rad/s) = satrec.no (rad/min) / 60
  const nRadSec = satrec.no / 60;
  // a = (GM / n^2)^(1/3)
  const semiMajorAxisKm = Math.pow(GM / (nRadSec * nRadSec), 1 / 3);

  // epoch
  const epochMs = jdayToMs(satrec.jdsatepoch);
  const epochDate = new Date(epochMs);
  const epochAgeDays = (Date.now() - epochMs) / 86400000;
  const epochHealth =
    epochAgeDays < 3 ? 'fresh' : epochAgeDays < 7 ? 'aging' : 'stale';

  // period in min
  const periodMinutes = 1440 / meanMotionRevDay;

  // apogee and perigee in km (alta/altp in earth radii)
  const apogeeKm = satrec.alta * EARTH_RADIUS_KM;
  const perigeeKm = satrec.altp * EARTH_RADIUS_KM;

  // estimated lifetime from re-entry predictor
  let estimatedLifetime = null;
  const reentryResult = estimateReentryTime(satellite);
  if (reentryResult) {
    const daysRemaining =
      (reentryResult.predictedDate.getTime() - Date.now()) / 86400000;
    estimatedLifetime = {
      days: daysRemaining,
      confidence: reentryResult.confidence,
      uncertaintyDays: reentryResult.uncertaintyDays,
    };
  }

  return {
    // orbital elements
    semiMajorAxisKm,
    eccentricity: satrec.ecco,
    inclinationDeg: satrec.inclo * RAD2DEG,
    raanDeg: satrec.nodeo * RAD2DEG,
    argPerigeeDeg: satrec.argpo * RAD2DEG,
    meanAnomalyDeg: satrec.mo * RAD2DEG,
    meanMotionRevDay,

    // TLE health
    epochDate,
    epochAgeDays,
    epochHealth,
    bstar: satrec.bstar,
    ndot: satrec.ndot,
    nddot: satrec.nddot,

    // derived
    periodMinutes,
    apogeeKm,
    perigeeKm,
    estimatedLifetime,
  };
}
