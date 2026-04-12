import { parseGPData } from '../utils/tleData.js';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';
// proxied through vite dev server to avoid CORS
const SATNOGS_TLE_URL = '/api/satnogs/api/tle/?format=json';
const TLE_API_BASE = '/api/tle/api/tle/';

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
const FETCH_TIMEOUT_MS = 10_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fetch w/ timeout helper
function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
}

// === source 1: CelesTrak (primary, group-based) ===

async function fetchCelestrakGroup(groupName) {
  const url = `${CELESTRAK_BASE}?GROUP=${groupName}&FORMAT=json`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json)) throw new Error('unexpected response');
  return parseGPData(json, groupName);
}

async function fetchFromCelestrak(onProgress) {
  const catalog = new Map();

  // test reachability w/ a small group first
  await fetchWithTimeout(`${CELESTRAK_BASE}?GROUP=stations&FORMAT=json`, {}, 8000);

  for (let i = 0; i < GROUPS.length; i++) {
    const group = GROUPS[i];
    try {
      const satellites = await fetchCelestrakGroup(group);
      for (const sat of satellites) {
        if (!catalog.has(sat.id)) catalog.set(sat.id, sat);
      }
    } catch (err) {
      console.warn(`[CelesTrak] Failed group "${group}":`, err.message);
    }

    if (onProgress) onProgress(catalog.size);
    if (i < GROUPS.length - 1) await delay(DELAY_MS);
  }

  if (catalog.size === 0) throw new Error('no satellites returned');
  return catalog;
}

// === source 2: SatNOGS DB (full catalog in one request) ===

function parseSatnogsData(json) {
  const results = [];
  for (const entry of json) {
    try {
      const tle1 = entry.tle1;
      const tle2 = entry.tle2;
      if (!tle1 || !tle2) continue;

      // extract name from tle0 (format: "0 SAT NAME")
      const name = entry.tle0 ? entry.tle0.replace(/^0\s+/, '') : `NORAD ${entry.norad_cat_id}`;

      results.push({
        id: entry.norad_cat_id,
        name,
        tle1,
        tle2,
        category: 'satnogs',
        objectType: null,
        countryCode: null,
        launchDate: null,
        epoch: null,
        inclination: null,
        period: null,
        apogee: null,
        perigee: null,
      });
    } catch {
      // skip bad entries
    }
  }
  return results;
}

async function fetchFromSatnogs(onProgress) {
  console.log('[SatNOGS] Fetching full TLE catalog...');
  const response = await fetchWithTimeout(SATNOGS_TLE_URL, {}, 30_000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json)) throw new Error('unexpected response');

  const satellites = parseSatnogsData(json);
  const catalog = new Map();
  for (const sat of satellites) {
    if (!catalog.has(sat.id)) catalog.set(sat.id, sat);
  }

  if (onProgress) onProgress(catalog.size);
  if (catalog.size === 0) throw new Error('no satellites returned');
  console.log(`[SatNOGS] Loaded ${catalog.size} satellites`);
  return catalog;
}

// === source 3: TLE API (paginated, slower) ===

function parseTleApiData(members) {
  const results = [];
  for (const entry of members) {
    try {
      if (!entry.line1 || !entry.line2) continue;
      results.push({
        id: entry.satelliteId,
        name: entry.name || `NORAD ${entry.satelliteId}`,
        tle1: entry.line1,
        tle2: entry.line2,
        category: 'tle-api',
        objectType: null,
        countryCode: null,
        launchDate: null,
        epoch: null,
        inclination: null,
        period: null,
        apogee: null,
        perigee: null,
      });
    } catch {
      // skip bad entries
    }
  }
  return results;
}

async function fetchFromTleApi(onProgress) {
  console.log('[TLE-API] Fetching satellites (paginated)...');
  const catalog = new Map();
  let page = 1;
  let totalItems = Infinity;

  while (catalog.size < totalItems) {
    const url = `${TLE_API_BASE}?page=${page}&page_size=100`;
    const response = await fetchWithTimeout(url, {}, 15_000);
    if (!response.ok) throw new Error(`HTTP ${response.status} on page ${page}`);

    const json = await response.json();
    if (json.totalItems != null) totalItems = json.totalItems;
    const members = json.member || [];
    if (members.length === 0) break;

    const satellites = parseTleApiData(members);
    for (const sat of satellites) {
      if (!catalog.has(sat.id)) catalog.set(sat.id, sat);
    }

    if (onProgress) onProgress(catalog.size);
    page++;
    await delay(200); // be polite to shared hosting
  }

  if (catalog.size === 0) throw new Error('no satellites returned');
  console.log(`[TLE-API] Loaded ${catalog.size} satellites`);
  return catalog;
}

// === fallback chain: CelesTrak -> SatNOGS -> TLE API ===

const SOURCES = [
  { name: 'CelesTrak', fn: fetchFromCelestrak },
  { name: 'SatNOGS', fn: fetchFromSatnogs },
  { name: 'TLE-API', fn: fetchFromTleApi },
];

export async function fetchAllSatellites(onProgress) {
  for (const source of SOURCES) {
    try {
      console.log(`[Catalog] Trying ${source.name}...`);
      const catalog = await source.fn(onProgress);
      console.log(`[Catalog] ${source.name} succeeded: ${catalog.size} satellites`);
      return catalog;
    } catch (err) {
      console.warn(`[Catalog] ${source.name} failed:`, err.message);
    }
  }

  // all sources failed
  console.error('[Catalog] All sources failed, returning empty catalog');
  return new Map();
}

// start bg polling to refresh sat data, returns cleanup fn
export function startBackgroundPolling(refreshFn, intervalMs = 7_200_000) {
  const id = setInterval(refreshFn, intervalMs);
  return () => clearInterval(id);
}
