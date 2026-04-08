// Dark navy ocean color (barely perceptible against black space)
export const DARK_OCEAN_COLOR = '#0a0e1a';

// Coastline/border style (dimmed for subtlety)
export const COASTLINE_COLOR = 'rgba(180, 195, 215, 0.55)';
export const COASTLINE_WIDTH = 1.2;

// Landmass fill color (lighter blue to distinguish from dark navy oceans)
export const LANDMASS_COLOR = '#131b2e';

// Bloom settings for coastline glow
export const BLOOM_CONFIG = {
  enabled: true,
  contrast: 119,
  brightness: -0.2,
  delta: 1.0,
  sigma: 3.78,
  stepSize: 0.5,
};

// Camera defaults (matching satellitemap.space framing)
export const DEFAULT_CAMERA = {
  destination: { lon: 0, lat: 20, height: 20_000_000 },
  orientation: { heading: 0, pitch: -90, roll: 0 },
};

// Deep space starting position for zoom-in reveal
export const REVEAL_START = {
  destination: { lon: 0, lat: 0, height: 80_000_000 },
};

export const REVEAL_DURATION = 2.5; // seconds

// Zoom limits (approximate satellitemap.space range)
export const MIN_ZOOM_DISTANCE = 500_000;   // ~500 km
export const MAX_ZOOM_DISTANCE = 80_000_000; // ~80,000 km
