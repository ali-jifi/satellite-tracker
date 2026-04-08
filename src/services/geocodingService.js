const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for cities/places using the Nominatim geocoding API.
 * @param {string} query - The search term (city name, address, etc.)
 * @returns {Promise<Array<{label: string, lat: number, lon: number}>>}
 */
export async function searchCity(query) {
  if (!query || query.trim().length < 2) return [];

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      limit: '5',
      addressdetails: '1',
    });

    const response = await fetch(`${NOMINATIM_BASE}?${params}`, {
      headers: {
        'User-Agent': 'SatelliteTracker/1.0',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();

    return data.map((item) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}
