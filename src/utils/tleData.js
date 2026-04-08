import * as satellite from 'satellite.js';

/**
 * Parse CelesTrak GP JSON array into satellite objects with cached satrec.
 * @param {object[]} gpJsonArray - Array of GP JSON objects from CelesTrak.
 * @param {string} groupName - CelesTrak group name (used as category).
 * @returns {object[]} Parsed satellite objects.
 */
export function parseGPData(gpJsonArray, groupName) {
  const results = [];

  for (const gp of gpJsonArray) {
    try {
      const tle1 = gp.TLE_LINE1;
      const tle2 = gp.TLE_LINE2;
      if (!tle1 || !tle2) continue;

      const satrec = satellite.twoline2satrec(tle1, tle2);

      results.push({
        id: gp.NORAD_CAT_ID,
        name: gp.OBJECT_NAME,
        tle1,
        tle2,
        satrec,
        category: groupName,
        inclination: gp.INCLINATION,
        period: gp.PERIOD,
        apogee: gp.APOAPSIS,
        perigee: gp.PERIAPSIS,
        epoch: gp.EPOCH,
        objectType: gp.OBJECT_TYPE,
        countryCode: gp.COUNTRY_CODE,
        launchDate: gp.LAUNCH_DATE,
      });
    } catch {
      // Skip satellites with bad TLE data
    }
  }

  return results;
}

// === Legacy functions (kept for backward compatibility) ===

/** @deprecated Use CelesTrak GP JSON via celestrakService.js instead. */
export async function fetchTLEsFromCelesTrak(category = 'stations') {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${category}&FORMAT=tle`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    return parseTLEText(text);
  } catch (error) {
    console.error('Error fetching TLEs:', error);
    return [];
  }
}

/** @deprecated Use parseGPData for GP JSON format instead. */
export function parseTLEText(tleText) {
  const lines = tleText.trim().split('\n');
  const satellites = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      satellites.push({
        id: parseInt(lines[i + 1].substring(2, 7)),
        name: lines[i].trim(),
        tle1: lines[i + 1].trim(),
        tle2: lines[i + 2].trim(),
        category: 'imported',
      });
    }
  }

  return satellites;
}

/** @deprecated Use CelesTrak GP JSON format instead. */
export async function fetchTLEsFromSpaceTrack(username, password) {
  const loginUrl = 'https://www.space-track.org/ajaxauth/login';
  const queryUrl = 'https://www.space-track.org/basicspacedata/query/class/gp/EPOCH/>now-30/orderby/NORAD_CAT_ID/format/tle';

  try {
    await fetch(loginUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `identity=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });

    const response = await fetch(queryUrl, {
      credentials: 'include',
    });

    const text = await response.text();
    return parseTLEText(text);
  } catch (error) {
    console.error('Error fetching from Space-Track:', error);
    return [];
  }
}
