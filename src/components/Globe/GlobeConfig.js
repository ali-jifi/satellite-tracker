// globe base color doubles as landmass - lighter blue so land is visible
export const GLOBE_BASE_COLOR = '#131b2e';

// bloom settings for tile glow
export const BLOOM_CONFIG = {
  enabled: true,
  contrast: 119,
  brightness: -0.2,
  delta: 1.0,
  sigma: 3.78,
  stepSize: 0.5,
};

// camera defaults (matching satellitemap.space framing)
export const DEFAULT_CAMERA = {
  destination: { lon: 0, lat: 20, height: 20_000_000 },
  orientation: { heading: 0, pitch: -90, roll: 0 },
};

// deep space start pos for zoom-in reveal
export const REVEAL_START = {
  destination: { lon: 0, lat: 0, height: 80_000_000 },
};

export const REVEAL_DURATION = 2.5; // sec

// globe style configs
export const GLOBE_STYLES = {
  photo: {
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    baseColor: '#131b2e',
    enableLighting: true,
    tileAlpha: 1.0,
  },
  daynight: {
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    baseColor: '#131b2e',
    enableLighting: true,
    tileAlpha: 1.0,
  },
  dark: {
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    baseColor: '#1a1a1a',
    enableLighting: false,
    tileAlpha: 0.3,
  },
};

// zoom limits (approx satellitemap.space range)
export const MIN_ZOOM_DISTANCE = 500_000;   // ~500 km
export const MAX_ZOOM_DISTANCE = 80_000_000; // ~80,000 km
