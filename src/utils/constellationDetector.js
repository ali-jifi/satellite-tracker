import * as satellite from 'satellite.js';

/**
 * Known constellation patterns — regex-based name matching with minimum count thresholds.
 */
export const CONSTELLATION_PATTERNS = [
  { name: 'Starlink', pattern: /^STARLINK/i, minCount: 50 },
  { name: 'OneWeb', pattern: /^ONEWEB/i, minCount: 5 },
  { name: 'Iridium', pattern: /^IRIDIUM/i, minCount: 5 },
  { name: 'GPS', pattern: /^(GPS|NAVSTAR)/i, minCount: 5 },
  { name: 'GLONASS', pattern: /^GLONASS|^COSMOS.*\(GLONASS\)/i, minCount: 5 },
  { name: 'Galileo', pattern: /^GALILEO|^GSAT/i, minCount: 4 },
  { name: 'Beidou', pattern: /^BEIDOU/i, minCount: 5 },
  { name: 'Globalstar', pattern: /^GLOBALSTAR/i, minCount: 5 },
  { name: 'Orbcomm', pattern: /^ORBCOMM/i, minCount: 5 },
  { name: 'Planet Labs', pattern: /^FLOCK|^DOVE/i, minCount: 10 },
  { name: 'Spire', pattern: /^LEMUR/i, minCount: 5 },
  { name: 'Swarm', pattern: /^SPACEBEE/i, minCount: 5 },
];

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;

/**
 * Compute active/decayed/deorbiting stats for a group of satellites.
 * - active: perigee > 200km AND (no satrec OR ndot <= 0.001)
 * - decayed: perigee < 200km
 * - deorbiting: perigee >= 200km but ndot > 0.001
 */
function computeConstellationStats(satellites) {
  let active = 0;
  let decayed = 0;
  let deorbiting = 0;

  for (const sat of satellites) {
    // Use GP JSON perigee field if available, else derive from satrec
    let perigee = sat.perigee;
    if (perigee == null && sat.satrec) {
      // satrec.altp is perigee altitude in Earth radii (satellite.js internals)
      // Actually satrec stores semi-major axis; perigee = a*(1-e) - 1 in earth radii
      // But we already have sat.perigee from GP JSON, so this is a fallback
      const a = sat.satrec.a; // earth radii
      const e = sat.satrec.ecco;
      if (a && e != null) {
        perigee = (a * (1 - e) - 1) * EARTH_RADIUS_KM;
      }
    }

    const ndot = sat.satrec ? Math.abs(sat.satrec.ndot) : 0;

    if (perigee != null && perigee < 200) {
      decayed++;
    } else if (ndot > 0.001) {
      deorbiting++;
    } else {
      active++;
    }
  }

  return { active, decayed, deorbiting, total: satellites.length };
}

/**
 * Detect constellations from a satellite array by matching name patterns.
 * Returns array of { name, satellites, stats } sorted by total descending.
 */
export function detectConstellations(satelliteArray) {
  const groups = new Map();

  for (const sat of satelliteArray) {
    if (!sat.name) continue;

    for (const { name, pattern } of CONSTELLATION_PATTERNS) {
      if (pattern.test(sat.name)) {
        if (!groups.has(name)) {
          groups.set(name, []);
        }
        groups.get(name).push(sat);
        break; // first match wins
      }
    }
  }

  const results = [];
  for (const { name, minCount } of CONSTELLATION_PATTERNS) {
    const sats = groups.get(name);
    if (!sats || sats.length < minCount) continue;

    results.push({
      name,
      satellites: sats,
      stats: computeConstellationStats(sats),
    });
  }

  // Sort by total count descending
  results.sort((a, b) => b.stats.total - a.stats.total);
  return results;
}

/**
 * Compute approximate coverage percentage for a constellation.
 * Uses a coarse 10-degree lat/lon grid (648 cells) and checks if any satellite
 * has elevation > threshold from each cell center.
 *
 * @param {object[]} satellites - Array of satellite objects with satrec
 * @param {number} [elevationThresholdDeg=5] - Minimum elevation in degrees
 * @param {Date} [time] - Time to propagate to (default: now)
 * @returns {number} Coverage percentage (0-100)
 */
export function computeCoverage(satellites, elevationThresholdDeg = 5, time = null) {
  const now = time || new Date();
  const gmst = satellite.gstime(now);

  // Pre-propagate all satellite positions to ECI, then convert to ECF
  const satEcfs = [];
  for (const sat of satellites) {
    if (!sat.satrec) continue;
    try {
      const posVel = satellite.propagate(sat.satrec, now);
      if (!posVel.position) continue;
      const ecf = satellite.eciToEcf(posVel.position, gmst);
      satEcfs.push(ecf);
    } catch {
      // skip bad propagation
    }
  }

  if (satEcfs.length === 0) return 0;

  let coveredCells = 0;
  let totalCells = 0;

  // 10-degree grid: lat -90 to 80 (step 10), lon -180 to 170 (step 10)
  for (let lat = -90; lat <= 80; lat += 10) {
    for (let lon = -180; lon <= 170; lon += 10) {
      totalCells++;
      const centerLat = lat + 5;
      const centerLon = lon + 5;

      const observerGd = {
        latitude: centerLat * DEG2RAD,
        longitude: centerLon * DEG2RAD,
        height: 0,
      };

      let covered = false;
      for (const ecf of satEcfs) {
        try {
          const lookAngles = satellite.ecfToLookAngles(observerGd, ecf);
          if (lookAngles.elevation * RAD2DEG > elevationThresholdDeg) {
            covered = true;
            break;
          }
        } catch {
          // skip
        }
      }

      if (covered) coveredCells++;
    }
  }

  return totalCells > 0 ? (coveredCells / totalCells) * 100 : 0;
}

/**
 * Hardcoded historical growth milestones for major constellations.
 * Used for Chart.js line chart rendering.
 */
export const GROWTH_MILESTONES = {
  'Starlink': [
    { date: '2019-05-24', count: 60 },
    { date: '2020-01-29', count: 240 },
    { date: '2020-06-13', count: 540 },
    { date: '2021-01-20', count: 1015 },
    { date: '2021-09-14', count: 1791 },
    { date: '2022-03-09', count: 2091 },
    { date: '2022-12-28', count: 3580 },
    { date: '2023-07-23', count: 4900 },
    { date: '2024-01-02', count: 5651 },
    { date: '2024-09-01', count: 6400 },
    { date: '2025-03-01', count: 7000 },
  ],
  'OneWeb': [
    { date: '2020-02-07', count: 6 },
    { date: '2021-12-27', count: 394 },
    { date: '2022-10-22', count: 462 },
    { date: '2023-03-09', count: 544 },
  ],
};
