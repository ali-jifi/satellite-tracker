import * as satellite from 'satellite.js';
import SunCalc from 'suncalc';
import { estimateBrightness } from './brightnessEstimator.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const TWO_PI = 2 * Math.PI;

// vincenty formula for angular separation between two points on the celestial sphere
export function angularSeparation(alt1, az1, alt2, az2) {
  const dAz = az2 - az1;
  const sinAlt1 = Math.sin(alt1), cosAlt1 = Math.cos(alt1);
  const sinAlt2 = Math.sin(alt2), cosAlt2 = Math.cos(alt2);
  const num = Math.sqrt(
    (cosAlt2 * Math.sin(dAz)) ** 2 +
    (cosAlt1 * sinAlt2 - sinAlt1 * cosAlt2 * Math.cos(dAz)) ** 2
  );
  const den = sinAlt1 * sinAlt2 + cosAlt1 * cosAlt2 * Math.cos(dAz);
  return Math.atan2(num, den);
}

// compute sat look angles (az, el, range) from observer
function computeSatLookAngles(satrec, observer, date) {
  try {
    const posVel = satellite.propagate(satrec, date);
    if (!posVel.position) return null;

    const gmst = satellite.gstime(date);
    const ecf = satellite.eciToEcf(posVel.position, gmst);
    const observerGd = {
      longitude: observer.lon * DEG2RAD,
      latitude: observer.lat * DEG2RAD,
      height: 0,
    };
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

// get topocentric pos of a celestial body (sun or moon)
// converts suncalc south-based az to north-based
function getTargetPosition(targetBody, date, lat, lon) {
  let pos;
  if (targetBody === 'sun') {
    pos = SunCalc.getPosition(date, lat, lon);
  } else {
    pos = SunCalc.getMoonPosition(date, lat, lon);
  }
  // convert az from south-based to north-based
  const northAz = (pos.azimuth + Math.PI) % TWO_PI;
  return { altitude: pos.altitude, azimuth: northAz };
}

// predict sat transits across a celestial body
// two-phase algo: coarse scan at stepMs intervals, then 0.5s fine refinement
export function predictTransits(satellites, observer, targetBody, timeWindow, options = {}) {
  const {
    angularThresholdDeg = 2.0,
    minDurationMs = 0,
    stepMs = 10000,
  } = options;

  const { lat, lon } = observer;
  const startMs = timeWindow.start.getTime();
  const endMs = timeWindow.end.getTime();

  // phase 1: coarse scan to find candidate times
  // track per-sat to avoid dupe detections for same transit event
  const candidateMap = new Map(); // key: satId -> array of candidate ms timestamps

  for (let ms = startMs; ms <= endMs; ms += stepMs) {
    const date = new Date(ms);
    const target = getTargetPosition(targetBody, date, lat, lon);

    // skip if target body is below horizon
    if (target.altitude < 0) continue;

    for (const sat of satellites) {
      if (!sat.satrec) continue;
      const look = computeSatLookAngles(sat.satrec, observer, date);
      if (!look || look.elevation < 0) continue;

      const satAltRad = look.elevation * DEG2RAD;
      const satAzRad = look.azimuth * DEG2RAD;
      const angSep = angularSeparation(satAltRad, satAzRad, target.altitude, target.azimuth) * RAD2DEG;

      if (angSep < angularThresholdDeg) {
        if (!candidateMap.has(sat.id)) {
          candidateMap.set(sat.id, []);
        }
        candidateMap.get(sat.id).push(ms);
      }
    }
  }

  // group consecutive candidate timestamps into transit events
  const transits = [];
  const FINE_STEP = 500; // 0.5s refinement
  const REFINE_WINDOW = 30000; // +/- 30s around candidate

  for (const [satId, timestamps] of candidateMap) {
    // group consecutive timestamps (within 2x stepMs) into events
    const events = [];
    let eventStart = timestamps[0];
    let eventEnd = timestamps[0];

    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - eventEnd <= stepMs * 2) {
        eventEnd = timestamps[i];
      } else {
        events.push({ start: eventStart, end: eventEnd });
        eventStart = timestamps[i];
        eventEnd = timestamps[i];
      }
    }
    events.push({ start: eventStart, end: eventEnd });

    // find the sat obj
    const sat = satellites.find((s) => s.id === satId);
    if (!sat) continue;

    // phase 2: refine each event
    for (const event of events) {
      const refineStart = Math.max(startMs, event.start - REFINE_WINDOW);
      const refineEnd = Math.min(endMs, event.end + REFINE_WINDOW);

      let minAngSep = Infinity;
      let minAngSepTime = null;
      let minAngSepRange = 0;
      let durationCount = 0;

      for (let ms = refineStart; ms <= refineEnd; ms += FINE_STEP) {
        const date = new Date(ms);
        const target = getTargetPosition(targetBody, date, lat, lon);
        if (target.altitude < 0) continue;

        const look = computeSatLookAngles(sat.satrec, observer, date);
        if (!look || look.elevation < 0) continue;

        const satAltRad = look.elevation * DEG2RAD;
        const satAzRad = look.azimuth * DEG2RAD;
        const angSep = angularSeparation(satAltRad, satAzRad, target.altitude, target.azimuth) * RAD2DEG;

        if (angSep < angularThresholdDeg) {
          durationCount++;
        }

        if (angSep < minAngSep) {
          minAngSep = angSep;
          minAngSepTime = date;
          minAngSepRange = look.range;
        }
      }

      if (!minAngSepTime) continue;

      const durationMs = durationCount * FINE_STEP;
      if (durationMs < minDurationMs) continue;

      transits.push({
        satelliteId: sat.id,
        name: sat.name,
        targetBody,
        time: minAngSepTime,
        angularDistanceDeg: minAngSep,
        angularDistanceArcsec: minAngSep * 3600,
        durationMs,
        brightness: estimateBrightness(minAngSepRange),
      });
    }
  }

  // sort by time asc
  transits.sort((a, b) => a.time.getTime() - b.time.getTime());
  return transits;
}

// warning mode: scan next 2h for both sun and moon transits
// uses coarse 10s step w/ 2deg threshold
export function predictTransitsWarningMode(satellites, observer, options = {}) {
  const {
    hoursAhead = 2,
    angularThresholdDeg = 2.0,
  } = options;

  const now = new Date();
  const timeWindow = {
    start: now,
    end: new Date(now.getTime() + hoursAhead * 3600000),
  };

  const scanOptions = { angularThresholdDeg, stepMs: 10000 };

  const sunTransits = predictTransits(satellites, observer, 'sun', timeWindow, scanOptions);
  const moonTransits = predictTransits(satellites, observer, 'moon', timeWindow, scanOptions);

  const combined = [...sunTransits, ...moonTransits];
  combined.sort((a, b) => a.time.getTime() - b.time.getTime());
  return combined;
}

// planning mode: scan user-specified window at higher precision
// returns transit results w/ arcsec precision, sorted by angular distance
export function predictTransitsPlanningMode(satellites, observer, config) {
  const {
    targetBody,
    startDate,
    endDate,
    minDurationMs = 0,
    angularThresholdDeg = 2.0,
  } = config;

  const timeWindow = { start: startDate, end: endDate };

  const results = predictTransits(satellites, observer, targetBody, timeWindow, {
    angularThresholdDeg,
    minDurationMs,
    stepMs: 1000, // 1s coarse step for higher precision
  });

  // sort by angular distance (closest first) for planning use
  results.sort((a, b) => a.angularDistanceDeg - b.angularDistanceDeg);
  return results;
}
