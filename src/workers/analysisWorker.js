import * as satellite from 'satellite.js';

// analysis web worker - heavy computation off main thread
// receives TLE strings (not satrec objs) since satrecs aren't transferable

self.onmessage = function (e) {
  const { type } = e.data;

  switch (type) {
    case 'findCloseApproaches':
      handleCloseApproaches(e.data);
      break;
    default:
      console.warn(`[AnalysisWorker] Unknown message type: ${type}`);
  }
};

// propagate satrec to ECI pos/vel
function propagateEci(satrec, date) {
  try {
    const posVel = satellite.propagate(satrec, date);
    if (!posVel.position || typeof posVel.position !== 'object') return null;
    return posVel;
  } catch {
    return null;
  }
}

// compute ECI distance between two satrecs at a date
function workerComputeDistance(satrec1, satrec2, date) {
  const pv1 = propagateEci(satrec1, date);
  const pv2 = propagateEci(satrec2, date);
  if (!pv1 || !pv2) return null;

  const dx = pv1.position.x - pv2.position.x;
  const dy = pv1.position.y - pv2.position.y;
  const dz = pv1.position.z - pv2.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// handle close approach detection
function handleCloseApproaches(data) {
  const { referenceTle, candidateTles, options = {} } = data;
  const {
    thresholdKm = 50,
    scanHours = 24,
    startTime = Date.now(),
  } = options;

  // parse satrecs from TLE strings
  let refSatrec;
  try {
    refSatrec = satellite.twoline2satrec(referenceTle.line1, referenceTle.line2);
  } catch {
    self.postMessage({ type: 'closeApproachResults', results: [], error: 'Invalid reference TLE' });
    return;
  }

  const candidates = [];
  for (const tle of candidateTles) {
    try {
      const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
      candidates.push({ id: tle.id, name: tle.name, satrec });
    } catch {
      // skip invalid TLEs
    }
  }

  const startMs = startTime;
  const endMs = startMs + scanHours * 3600000;
  const coarseStepMs = 60000;
  const fineStepMs = 1000;
  const fineWindowMs = 120000;

  const results = [];
  const progressInterval = Math.max(1, Math.floor(candidates.length / 10));

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];

    // report progress
    if (i % progressInterval === 0) {
      self.postMessage({
        type: 'progress',
        percent: Math.floor((i / candidates.length) * 100),
      });
    }

    // phase 1: coarse scan
    let minDist = Infinity;
    let minTime = startMs;

    for (let t = startMs; t <= endMs; t += coarseStepMs) {
      const date = new Date(t);
      const dist = workerComputeDistance(refSatrec, cand.satrec, date);
      if (dist !== null && dist < minDist) {
        minDist = dist;
        minTime = t;
      }
    }

    if (minDist > thresholdKm) continue;

    // phase 2: fine refinement
    const fineStart = Math.max(startMs, minTime - fineWindowMs);
    const fineEnd = Math.min(endMs, minTime + fineWindowMs);

    for (let t = fineStart; t <= fineEnd; t += fineStepMs) {
      const date = new Date(t);
      const dist = workerComputeDistance(refSatrec, cand.satrec, date);
      if (dist !== null && dist < minDist) {
        minDist = dist;
        minTime = t;
      }
    }

    // compute relative velocity at closest approach
    const approachDate = new Date(minTime);
    const refPv = propagateEci(refSatrec, approachDate);
    const candPv = propagateEci(cand.satrec, approachDate);

    let relVel = null;
    if (refPv?.velocity && candPv?.velocity) {
      const dvx = refPv.velocity.x - candPv.velocity.x;
      const dvy = refPv.velocity.y - candPv.velocity.y;
      const dvz = refPv.velocity.z - candPv.velocity.z;
      relVel = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
    }

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

  results.sort((a, b) => a.distanceKm - b.distanceKm);

  self.postMessage({
    type: 'closeApproachResults',
    results,
  });
}
