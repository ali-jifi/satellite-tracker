import { parseGPData } from '../utils/tleData.js';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

const GROUPS = [
  'active', 'stations', 'visual', 'starlink', 'oneweb',
  'gps-ops', 'glonass-ops', 'galileo', 'beidou',
  'weather', 'noaa', 'goes', 'resource', 'sarsat', 'dmc', 'tdrss', 'argos',
  'geo', 'intelsat', 'ses', 'iridium', 'iridium-NEXT', 'orbcomm', 'globalstar', 'swarm',
  'amateur', 'x-comm', 'other-comm', 'satnogs',
  'gorizont', 'raduga', 'molniya',
  'gnss', 'musson',
  'science', 'geodetic', 'engineering', 'education',
  'military', 'radar', 'cubesat', 'other',
];

const DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single CelesTrak satellite group in GP JSON format.
 * Returns parsed satellite objects or empty array on failure.
 */
export async function fetchSatelliteGroup(groupName) {
  const url = `${CELESTRAK_BASE}?GROUP=${groupName}&FORMAT=json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[CelesTrak] HTTP ${response.status} for group "${groupName}"`);
      return [];
    }
    const json = await response.json();
    if (!Array.isArray(json)) {
      console.warn(`[CelesTrak] Unexpected response for group "${groupName}"`);
      return [];
    }
    return parseGPData(json, groupName);
  } catch (error) {
    console.error(`[CelesTrak] Failed to fetch group "${groupName}":`, error);
    return [];
  }
}

/**
 * Fetch all CelesTrak groups sequentially with rate-limit protection.
 * De-duplicates by NORAD ID (first occurrence wins).
 * @param {function} [onProgress] - Called with current total count after each group.
 * @returns {Promise<Map<number, object>>} Map of NORAD_CAT_ID -> satellite object.
 */
export async function fetchAllSatellites(onProgress) {
  const catalog = new Map();

  for (let i = 0; i < GROUPS.length; i++) {
    const group = GROUPS[i];
    const satellites = await fetchSatelliteGroup(group);

    for (const sat of satellites) {
      if (!catalog.has(sat.id)) {
        catalog.set(sat.id, sat);
      }
    }

    if (onProgress) {
      onProgress(catalog.size);
    }

    // Rate-limit delay between requests (skip after last group)
    if (i < GROUPS.length - 1) {
      await delay(DELAY_MS);
    }
  }

  return catalog;
}

/**
 * Start background polling to refresh satellite data.
 * @param {function} refreshFn - Async function to call on each poll cycle.
 * @param {number} [intervalMs=7200000] - Poll interval (default 2 hours).
 * @returns {function} Cleanup function to stop polling.
 */
export function startBackgroundPolling(refreshFn, intervalMs = 7_200_000) {
  const id = setInterval(refreshFn, intervalMs);
  return () => clearInterval(id);
}
