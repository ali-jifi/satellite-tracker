import * as satellite from 'satellite.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Compute look angles (azimuth, elevation, range) for a satellite at a given time.
 * @param {Object} satrec - satellite.js satrec object
 * @param {Object} observerGd - { longitude, latitude, height } in RADIANS
 * @param {Date} date - time to compute
 * @returns {{ azimuth: number, elevation: number, range: number } | null} degrees/km
 */
function computeLookAngles(satrec, observerGd, date) {
  try {
    const posVel = satellite.propagate(satrec, date);
    if (!posVel.position) return null;

    const gmst = satellite.gstime(date);
    const ecf = satellite.eciToEcf(posVel.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);

    return {
      azimuth: look.azimuth * RAD2DEG,
      elevation: look.elevation * RAD2DEG,
      range: look.rangeSat,
    };
  } catch {
    return null;
  }
}

/**
 * Refine the boundary (rise or set time) of a pass using 1-second linear scan.
 * @param {Object} satrec
 * @param {Object} observerGd - radians
 * @param {Date} searchStart - start of search window
 * @param {Date} searchEnd - end of search window
 * @param {boolean} isRising - true = find rise (below->above), false = find set (above->below)
 * @returns {{ time: Date, azimuth: number }}
 */
function refineBoundary(satrec, observerGd, searchStart, searchEnd, isRising) {
  const startMs = searchStart.getTime();
  const endMs = searchEnd.getTime();
  const step = isRising ? 1000 : 1000;
  let bestTime = isRising ? searchEnd : searchStart;
  let bestAz = 0;

  for (let ms = startMs; ms <= endMs; ms += step) {
    const date = new Date(ms);
    const look = computeLookAngles(satrec, observerGd, date);
    if (!look) continue;

    if (isRising) {
      // Find the first moment elevation >= 0
      if (look.elevation >= 0) {
        bestTime = date;
        bestAz = look.azimuth;
        break;
      }
    } else {
      // Find the last moment elevation >= 0
      if (look.elevation >= 0) {
        bestTime = date;
        bestAz = look.azimuth;
      } else {
        break;
      }
    }
  }

  return { time: bestTime, azimuth: bestAz };
}

/**
 * Find upcoming satellite passes visible from observer location.
 *
 * Two-phase brute-force algorithm:
 *   Phase 1: Coarse scan at 60-second steps to detect pass boundaries
 *   Phase 2: Fine refinement at 1-second steps for precise AOS/LOS times
 *
 * @param {Object} satrec - satellite.js satrec object
 * @param {Object} observerGd - { longitude, latitude, height } in RADIANS
 * @param {Date} startTime - scan start
 * @param {Object} [options]
 * @param {number} [options.maxHours=24] - hours to scan ahead
 * @param {number} [options.maxPasses=5] - max passes to return
 * @param {number} [options.minElevation=0] - min elevation in degrees
 * @returns {Promise<Array<{
 *   start: Date,
 *   end: Date,
 *   maxElevation: number,
 *   maxElevationTime: Date,
 *   startAzimuth: number,
 *   maxAzimuth: number,
 *   endAzimuth: number,
 *   duration: number
 * }>>}
 */
export function findPasses(satrec, observerGd, startTime, options = {}) {
  const {
    maxHours = 24,
    maxPasses = 5,
    minElevation = 0,
  } = options;

  return new Promise((resolve) => {
    const passes = [];
    const startMs = startTime.getTime();
    const endMs = startMs + maxHours * 3600000;
    const coarseStep = 60000; // 60 seconds

    // Estimate orbital period for max pass duration cap (~2x typical LEO period)
    const meanMotion = satrec.no; // rad/min
    const orbitalPeriodMs = meanMotion > 0
      ? (2 * Math.PI / meanMotion) * 60 * 1000
      : 7200000; // fallback 2h
    const maxPassDuration = orbitalPeriodMs; // cap at one full orbit

    // Phase 1: Coarse scan
    let inPass = false;
    let coarseStart = null;
    let coarseEnd = null;
    let maxEl = -Infinity;
    let maxElTime = null;
    let maxElAz = 0;

    // Check if satellite is already above horizon at start
    const initialLook = computeLookAngles(satrec, observerGd, startTime);
    if (initialLook && initialLook.elevation > minElevation) {
      // Mid-pass at scan start: scan backward to find rise
      inPass = true;
      coarseStart = startTime;
      maxEl = initialLook.elevation;
      maxElTime = startTime;
      maxElAz = initialLook.azimuth;

      // Scan backward up to 15 minutes to find rise
      for (let ms = startMs; ms > startMs - 900000; ms -= coarseStep) {
        const look = computeLookAngles(satrec, observerGd, new Date(ms));
        if (!look || look.elevation <= minElevation) {
          coarseStart = new Date(ms);
          break;
        }
      }
    }

    for (let ms = startMs + coarseStep; ms <= endMs; ms += coarseStep) {
      if (passes.length >= maxPasses) break;

      const date = new Date(ms);
      const look = computeLookAngles(satrec, observerGd, date);

      if (!look) {
        // Propagation failure: if in pass, close it
        if (inPass) {
          coarseEnd = new Date(ms - coarseStep);
          passes.push({ coarseStart, coarseEnd, maxEl, maxElTime, maxElAz });
          inPass = false;
        }
        continue;
      }

      if (look.elevation > minElevation) {
        if (!inPass) {
          // Pass start
          inPass = true;
          coarseStart = new Date(ms - coarseStep);
          maxEl = look.elevation;
          maxElTime = date;
          maxElAz = look.azimuth;
        } else {
          // Continuation: check max pass duration
          if (ms - coarseStart.getTime() > maxPassDuration) {
            coarseEnd = date;
            passes.push({ coarseStart, coarseEnd, maxEl, maxElTime, maxElAz });
            inPass = false;
            continue;
          }
          if (look.elevation > maxEl) {
            maxEl = look.elevation;
            maxElTime = date;
            maxElAz = look.azimuth;
          }
        }
      } else if (inPass) {
        // Pass end
        coarseEnd = date;
        passes.push({ coarseStart, coarseEnd, maxEl, maxElTime, maxElAz });
        inPass = false;
      }
    }

    // If still in pass at end of scan window, close it
    if (inPass && passes.length < maxPasses) {
      coarseEnd = new Date(endMs);
      passes.push({ coarseStart, coarseEnd, maxEl, maxElTime, maxElAz });
    }

    // Phase 2: Fine refinement
    const refined = passes.map((p) => {
      // Refine start (rise)
      const riseWindow = new Date(Math.max(p.coarseStart.getTime() - 60000, startMs - 900000));
      const riseEnd = new Date(p.coarseStart.getTime() + 120000);
      const rise = refineBoundary(satrec, observerGd, riseWindow, riseEnd, true);

      // Refine end (set)
      const setStart = new Date(p.coarseEnd.getTime() - 120000);
      const setEnd = new Date(p.coarseEnd.getTime() + 60000);
      const set_ = refineBoundary(satrec, observerGd, setStart, setEnd, false);

      // Refine max elevation: scan around coarse max at 1-second steps
      let bestEl = p.maxEl;
      let bestElTime = p.maxElTime;
      let bestElAz = p.maxElAz;
      const maxScanStart = p.maxElTime.getTime() - 60000;
      const maxScanEnd = p.maxElTime.getTime() + 60000;
      for (let ms = maxScanStart; ms <= maxScanEnd; ms += 1000) {
        const look = computeLookAngles(satrec, observerGd, new Date(ms));
        if (look && look.elevation > bestEl) {
          bestEl = look.elevation;
          bestElTime = new Date(ms);
          bestElAz = look.azimuth;
        }
      }

      const startDate = rise.time;
      const endDate = set_.time;
      const duration = (endDate.getTime() - startDate.getTime()) / 1000;

      return {
        start: startDate,
        end: endDate,
        maxElevation: bestEl,
        maxElevationTime: bestElTime,
        startAzimuth: rise.azimuth,
        maxAzimuth: bestElAz,
        endAzimuth: set_.azimuth,
        duration: Math.max(0, duration),
      };
    });

    // Filter out passes with max elevation below minimum
    const filtered = refined.filter((p) => p.maxElevation > minElevation && p.duration > 0);
    resolve(filtered);
  });
}
