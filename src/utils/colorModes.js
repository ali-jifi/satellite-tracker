import * as Cesium from 'cesium';

// === inclination mode (default) ===
// gradient: red -> orange -> yellow -> green -> blue by orbital inclination

export const INCLINATION_COLORS = [
  { maxInclination: 30, color: '#ff4444', label: '0-30' },
  { maxInclination: 60, color: '#ff8c00', label: '30-60' },
  { maxInclination: 90, color: '#ffd700', label: '60-90' },
  { maxInclination: 120, color: '#00ff88', label: '90-120' },
  { maxInclination: 180, color: '#4488ff', label: '120-180' },
];

// pre-computed Cesium.Color objects for inclination bands
const INCLINATION_CESIUM = INCLINATION_COLORS.map((entry) => ({
  ...entry,
  cesiumColor: Cesium.Color.fromCssColorString(entry.color),
}));

// pre-computed raw floats for inclination bands (for PointPrimitive hot loop)
const INCLINATION_RAW = INCLINATION_COLORS.map((entry) => {
  const c = Cesium.Color.fromCssColorString(entry.color);
  return { maxInclination: entry.maxInclination, red: c.red, green: c.green, blue: c.blue };
});

// === category mode ===

export const CATEGORY_COLORS = {
  // communications
  'iridium': '#00e5ff',
  'iridium-NEXT': '#00e5ff',
  'orbcomm': '#00e5ff',
  'globalstar': '#00e5ff',
  'swarm': '#00e5ff',
  'intelsat': '#00e5ff',
  'ses': '#00e5ff',
  'other-comm': '#00e5ff',
  'x-comm': '#00e5ff',
  'starlink': '#00e5ff',
  'oneweb': '#00e5ff',
  // navigation
  'gps-ops': '#00e676',
  'glonass-ops': '#00e676',
  'galileo': '#00e676',
  'beidou': '#00e676',
  'gnss': '#00e676',
  // weather
  'weather': '#ffea00',
  'noaa': '#ffea00',
  'goes': '#ffea00',
  // science
  'science': '#d500f9',
  'geodetic': '#d500f9',
  'engineering': '#d500f9',
  'education': '#d500f9',
  // military
  'military': '#ff1744',
  'radar': '#ff1744',
  // amateur
  'amateur': '#ff9100',
  'satnogs': '#ff9100',
  // other
  'active': '#cccccc',
  'visual': '#cccccc',
  'stations': '#cccccc',
  'geo': '#cccccc',
  'resource': '#cccccc',
  'sarsat': '#cccccc',
  'dmc': '#cccccc',
  'tdrss': '#cccccc',
  'argos': '#cccccc',
  'gorizont': '#cccccc',
  'raduga': '#cccccc',
  'molniya': '#cccccc',
  'musson': '#cccccc',
  'cubesat': '#cccccc',
  'other': '#cccccc',
};

// pre-compute category Cesium colors and raw floats
const CATEGORY_CESIUM_CACHE = {};
const CATEGORY_RAW_CACHE = {};
for (const [key, hex] of Object.entries(CATEGORY_COLORS)) {
  const c = Cesium.Color.fromCssColorString(hex);
  CATEGORY_CESIUM_CACHE[key] = c;
  CATEGORY_RAW_CACHE[key] = { red: c.red, green: c.green, blue: c.blue };
}

const DEFAULT_CATEGORY_CESIUM = Cesium.Color.fromCssColorString('#cccccc');
const DEFAULT_CATEGORY_RAW = { red: DEFAULT_CATEGORY_CESIUM.red, green: DEFAULT_CATEGORY_CESIUM.green, blue: DEFAULT_CATEGORY_CESIUM.blue };

// debris color
const DEBRIS_HEX = '#9e9e9e';
const DEBRIS_CESIUM = Cesium.Color.fromCssColorString(DEBRIS_HEX);
const DEBRIS_RAW = { red: DEBRIS_CESIUM.red, green: DEBRIS_CESIUM.green, blue: DEBRIS_CESIUM.blue };

// === alt mode ===

const ALT_LEO_CESIUM = Cesium.Color.fromCssColorString('#00ff88');
const ALT_MEO_CESIUM = Cesium.Color.fromCssColorString('#ffd700');
const ALT_GEO_CESIUM = Cesium.Color.fromCssColorString('#ff4444');
const ALT_LEO_RAW = { red: ALT_LEO_CESIUM.red, green: ALT_LEO_CESIUM.green, blue: ALT_LEO_CESIUM.blue };
const ALT_MEO_RAW = { red: ALT_MEO_CESIUM.red, green: ALT_MEO_CESIUM.green, blue: ALT_MEO_CESIUM.blue };
const ALT_GEO_RAW = { red: ALT_GEO_CESIUM.red, green: ALT_GEO_CESIUM.green, blue: ALT_GEO_CESIUM.blue };

// === country mode ===

const COUNTRY_MAP = {
  'US': '#4488ff',
  'CIS': '#ff4444',
  'CN': '#ffd700',
  'JP': '#ffffff',
  'FR': '#00e5ff', 'DE': '#00e5ff', 'IT': '#00e5ff', 'ESA': '#00e5ff', 'EU': '#00e5ff',
  'IN': '#ff9100',
  'UK': '#d500f9',
};

const COUNTRY_CESIUM_CACHE = {};
const COUNTRY_RAW_CACHE = {};
for (const [key, hex] of Object.entries(COUNTRY_MAP)) {
  const c = Cesium.Color.fromCssColorString(hex);
  COUNTRY_CESIUM_CACHE[key] = c;
  COUNTRY_RAW_CACHE[key] = { red: c.red, green: c.green, blue: c.blue };
}

const DEFAULT_COUNTRY_CESIUM = Cesium.Color.fromCssColorString('#aaaaaa');
const DEFAULT_COUNTRY_RAW = { red: DEFAULT_COUNTRY_CESIUM.red, green: DEFAULT_COUNTRY_CESIUM.green, blue: DEFAULT_COUNTRY_CESIUM.blue };

// === public API ===

// check if sat is debris based on objectType field
export function isDebris(satellite) {
  return satellite.objectType === 'DEBRIS' || satellite.objectType === 'DEB';
}

// get Cesium.Color for a sat based on current color mode
export function getColorForSatellite(satellite, mode, altitude) {
  if (isDebris(satellite)) return DEBRIS_CESIUM;

  switch (mode) {
    case 'inclination': {
      const inc = satellite.inclination ?? 0;
      for (const band of INCLINATION_CESIUM) {
        if (inc <= band.maxInclination) return band.cesiumColor;
      }
      return INCLINATION_CESIUM[INCLINATION_CESIUM.length - 1].cesiumColor;
    }

    case 'category':
      return CATEGORY_CESIUM_CACHE[satellite.category] || DEFAULT_CATEGORY_CESIUM;

    case 'altitude': {
      const alt = altitude ?? satellite.apogee ?? 0;
      if (alt < 2000) return ALT_LEO_CESIUM;
      if (alt < 35000) return ALT_MEO_CESIUM;
      return ALT_GEO_CESIUM;
    }

    case 'country':
      return COUNTRY_CESIUM_CACHE[satellite.countryCode] || DEFAULT_COUNTRY_CESIUM;

    default:
      return DEFAULT_CATEGORY_CESIUM;
  }
}

// get raw {red, green, blue} floats (0-1) for a sat, avoids allocating Cesium.Color in hot loop
export function getColorForSatelliteRaw(satellite, mode, altitude) {
  if (isDebris(satellite)) return DEBRIS_RAW;

  switch (mode) {
    case 'inclination': {
      const inc = satellite.inclination ?? 0;
      for (const band of INCLINATION_RAW) {
        if (inc <= band.maxInclination) return band;
      }
      return INCLINATION_RAW[INCLINATION_RAW.length - 1];
    }

    case 'category':
      return CATEGORY_RAW_CACHE[satellite.category] || DEFAULT_CATEGORY_RAW;

    case 'altitude': {
      const alt = altitude ?? satellite.apogee ?? 0;
      if (alt < 2000) return ALT_LEO_RAW;
      if (alt < 35000) return ALT_MEO_RAW;
      return ALT_GEO_RAW;
    }

    case 'country':
      return COUNTRY_RAW_CACHE[satellite.countryCode] || DEFAULT_COUNTRY_RAW;

    default:
      return DEFAULT_CATEGORY_RAW;
  }
}
