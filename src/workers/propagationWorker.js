import * as satellite from 'satellite.js';

/** @type {Map<number, object>} NORAD ID -> satrec */
const satrecCache = new Map();

self.onmessage = function (e) {
  const { type } = e.data;

  switch (type) {
    case 'init':
      handleInit(e.data);
      break;
    case 'propagate':
      handlePropagate(e.data);
      break;
    case 'update':
      handleUpdate(e.data);
      break;
    default:
      console.warn(`[PropagationWorker] Unknown message type: ${type}`);
  }
};

/**
 * Initialize satrec cache from TLE data.
 * @param {{ satellites: Array<{ id: number, tle1: string, tle2: string }> }} data
 */
function handleInit(data) {
  satrecCache.clear();
  let count = 0;

  for (const sat of data.satellites) {
    try {
      const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      satrecCache.set(sat.id, satrec);
      count++;
    } catch {
      // Skip satellites with invalid TLE data
    }
  }

  self.postMessage({ type: 'ready', count });
}

/**
 * Propagate all cached satrecs for the given timestamp.
 * Returns positions as a transferable Float64Array with layout [id, lat, lon, alt, ...].
 * @param {{ timestamp: number }} data - Date.now() milliseconds
 */
function handlePropagate(data) {
  const date = new Date(data.timestamp);
  const gmst = satellite.gstime(date);
  const buffer = new Float64Array(satrecCache.size * 5);
  let validCount = 0;

  for (const [id, satrec] of satrecCache) {
    try {
      const posVel = satellite.propagate(satrec, date);

      if (!posVel.position || typeof posVel.position !== 'object') {
        continue;
      }

      const geo = satellite.eciToGeodetic(posVel.position, gmst);
      const offset = validCount * 5;

      buffer[offset] = id;
      buffer[offset + 1] = satellite.degreesLat(geo.latitude);
      buffer[offset + 2] = satellite.degreesLong(geo.longitude);
      buffer[offset + 3] = geo.height;

      // Velocity magnitude (km/s) from ECI velocity vector
      if (posVel.velocity && typeof posVel.velocity === 'object') {
        const vx = posVel.velocity.x;
        const vy = posVel.velocity.y;
        const vz = posVel.velocity.z;
        buffer[offset + 4] = Math.sqrt(vx * vx + vy * vy + vz * vz);
      } else {
        buffer[offset + 4] = 0;
      }

      validCount++;
    } catch {
      // Skip failed propagations (decayed orbits, bad TLE, etc.)
    }
  }

  // Transfer the underlying ArrayBuffer for zero-copy
  const transferBuffer = buffer.buffer;
  self.postMessage(
    { type: 'positions', buffer: transferBuffer, count: validCount },
    [transferBuffer]
  );
}

/**
 * Update specific satrecs when TLEs are refreshed.
 * @param {{ satellites: Array<{ id: number, tle1: string, tle2: string }> }} data
 */
function handleUpdate(data) {
  let count = 0;

  for (const sat of data.satellites) {
    try {
      const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      satrecCache.set(sat.id, satrec);
      count++;
    } catch {
      // Skip invalid TLE data
    }
  }

  self.postMessage({ type: 'updated', count });
}
