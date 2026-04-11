import { useRef, useEffect, useCallback, useState } from 'react';
import * as satellite from 'satellite.js';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { findPasses } from '../../utils/passPredictor';
import {
  drawBackground,
  drawGrid,
  drawStars,
  drawSatellites,
  drawPassArcs,
  hitTest,
} from './SkyDomeRenderer';
import STARS from './starCatalog';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// throttle ~15fps for sat updates
const FRAME_INTERVAL = 1000 / 15;
// stars nearly static, redraw every 30s
const STAR_UPDATE_INTERVAL = 30000;
// pass predictions update every 5min
const PASS_UPDATE_INTERVAL = 300000;

// get CSS hex color for sat w/o Cesium dep, mirrors colorModes.js
function getSatelliteColor(sat, colorMode) {
  const isDebris = sat.objectType === 'DEBRIS' || sat.objectType === 'DEB';
  if (isDebris) return '#9e9e9e';

  switch (colorMode) {
    case 'inclination': {
      const inc = sat.inclination ?? 0;
      if (inc <= 30) return '#ff4444';
      if (inc <= 60) return '#ff8c00';
      if (inc <= 90) return '#ffd700';
      if (inc <= 120) return '#00ff88';
      return '#4488ff';
    }
    case 'category': {
      const COLORS = {
        'starlink': '#00e5ff', 'oneweb': '#00e5ff', 'iridium': '#00e5ff',
        'iridium-NEXT': '#00e5ff', 'orbcomm': '#00e5ff', 'globalstar': '#00e5ff',
        'swarm': '#00e5ff', 'intelsat': '#00e5ff', 'ses': '#00e5ff',
        'other-comm': '#00e5ff', 'x-comm': '#00e5ff',
        'gps-ops': '#00e676', 'glonass-ops': '#00e676', 'galileo': '#00e676',
        'beidou': '#00e676', 'gnss': '#00e676',
        'weather': '#ffea00', 'noaa': '#ffea00', 'goes': '#ffea00',
        'science': '#d500f9', 'geodetic': '#d500f9', 'engineering': '#d500f9',
        'education': '#d500f9',
        'military': '#ff1744', 'radar': '#ff1744',
        'amateur': '#ff9100', 'satnogs': '#ff9100',
      };
      return COLORS[sat.category] || '#cccccc';
    }
    case 'altitude':
      if ((sat.apogee ?? 0) < 2000) return '#00ff88';
      if ((sat.apogee ?? 0) < 35000) return '#ffd700';
      return '#ff4444';
    case 'country': {
      const MAP = {
        'US': '#4488ff', 'CIS': '#ff4444', 'CN': '#ffd700', 'JP': '#ffffff',
        'FR': '#00e5ff', 'DE': '#00e5ff', 'IT': '#00e5ff', 'ESA': '#00e5ff',
        'EU': '#00e5ff', 'IN': '#ff9100', 'UK': '#d500f9',
      };
      return MAP[sat.countryCode] || '#aaaaaa';
    }
    default:
      return '#cccccc';
  }
}

// get sim time from Cesium viewer clock
function getSimTime() {
  const viewer = useAppStore.getState().viewerRef;
  if (viewer && viewer.clock) {
    try {
      return window.Cesium
        ? window.Cesium.JulianDate.toDate(viewer.clock.currentTime)
        : new Date();
    } catch {
      return new Date();
    }
  }
  return new Date();
}

// compute look angles for sat from observer
function computeSatLookAngles(satrec, observerGd, date) {
  try {
    const posVel = satellite.propagate(satrec, date);
    if (!posVel.position) return null;

    const gmst = satellite.gstime(date);
    const ecf = satellite.eciToEcf(posVel.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);

    return {
      azimuth: look.azimuth * RAD2DEG,
      elevation: look.elevation * RAD2DEG,
      range: look.rangeSat,
    };
  } catch {
    return null;
  }
}

// pre-filter sats possibly above observer horizon using position buffer
function getVisibleSatellites(observerGd, simTime, colorMode) {
  const { satellites, positionBuffer, positionCount } = useSatelliteStore.getState();
  if (!positionBuffer || positionCount === 0) return [];

  const observerLat = observerGd.latitude * RAD2DEG;
  const observerLon = observerGd.longitude * RAD2DEG;
  const result = [];
  const stride = 5;

  // quick id->position lookup from buffer
  const posMap = new Map();
  for (let i = 0; i < positionCount; i++) {
    const offset = i * stride;
    const id = positionBuffer[offset];
    const lat = positionBuffer[offset + 1];
    const lon = positionBuffer[offset + 2];
    const alt = positionBuffer[offset + 3];
    posMap.set(id, { lat, lon, alt });
  }

  // rough angular dist filter; skip sats too far for horizon visibility
  // higher alt sats visible from further, ecfToLookAngles handles edge cases
  for (const [id, sat] of satellites) {
    if (!sat.satrec) continue;

    const pos = posMap.get(id);
    if (!pos) continue;

    // quick great-circle dist check (deg)
    const dlat = Math.abs(pos.lat - observerLat);
    const dlon = Math.abs(((pos.lon - observerLon + 540) % 360) - 180);
    const roughDist = Math.sqrt(dlat * dlat + dlon * dlon);

    // max visible angle by alt: LEO ~25, MEO ~50, GEO ~85 deg
    const maxAngle = pos.alt < 2000 ? 25 : pos.alt < 10000 ? 50 : 85;
    if (roughDist > maxAngle) continue;

    // precise look angles
    const look = computeSatLookAngles(sat.satrec, observerGd, simTime);
    if (!look || look.elevation <= 0) continue;

    result.push({
      id,
      name: sat.name || `SAT ${id}`,
      azimuth: look.azimuth,
      elevation: look.elevation,
      color: getSatelliteColor(sat, colorMode),
    });
  }

  return result;
}

export default function SkyDomeView() {
  const cameraMode = useAppStore((s) => s.cameraMode);
  const observerLocation = useAppStore((s) => s.observerLocation);
  const setCameraMode = useAppStore((s) => s.setCameraMode);

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastFrameRef = useRef(0);
  const visibleSatsRef = useRef([]);
  const highlightedRef = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const passArcsRef = useRef([]);
  const lastPassUpdateRef = useRef(0);

  // offscreen canvas for stars (cached)
  const starCanvasRef = useRef(null);
  const lastStarDrawRef = useRef(0);

  // layout
  const layoutRef = useRef({ cx: 0, cy: 0, radius: 0 });

  const active = cameraMode === 'skydome';

  // compute layout dims
  const updateLayout = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 50;
    layoutRef.current = { cx, cy, radius, w, h };
    return { cx, cy, radius, w, h };
  }, []);

  // draw stars to offscreen canvas
  const updateStarCanvas = useCallback((simTime) => {
    if (!observerLocation) return;
    const { cx, cy, radius, w, h } = layoutRef.current;
    if (!w || !h) return;

    if (!starCanvasRef.current) {
      starCanvasRef.current = document.createElement('canvas');
    }
    const offCanvas = starCanvasRef.current;
    offCanvas.width = w;
    offCanvas.height = h;

    const offCtx = offCanvas.getContext('2d');
    drawStars(offCtx, cx, cy, radius, STARS, observerLocation.lat, observerLocation.lon, simTime);
    lastStarDrawRef.current = Date.now();
  }, [observerLocation]);

  // compute pass prediction arcs for selected sats
  const updatePassArcs = useCallback(async (observerGd, simTime) => {
    const detailId = useSatelliteStore.getState().detailSatelliteId;
    const selectedIds = useSatelliteStore.getState().selectedIds;
    const sats = useSatelliteStore.getState().satellites;
    const colorMode = useSatelliteStore.getState().colorMode;

    // passes for selected + detail sats
    const idsToCheck = new Set(selectedIds);
    if (detailId) idsToCheck.add(detailId);

    const arcs = [];

    for (const id of idsToCheck) {
      const sat = sats.get(id);
      if (!sat || !sat.satrec) continue;

      try {
        const passes = await findPasses(sat.satrec, observerGd, simTime, {
          maxHours: 2,
          maxPasses: 3,
          minElevation: 0,
        });

        for (const pass of passes) {
          // arc points at ~30s intervals
          const points = [];
          const startMs = pass.start.getTime();
          const endMs = pass.end.getTime();
          const step = 30000; // 30s

          for (let ms = startMs; ms <= endMs; ms += step) {
            const look = computeSatLookAngles(sat.satrec, observerGd, new Date(ms));
            if (look) {
              points.push({ azimuth: look.azimuth, elevation: look.elevation });
            }
          }
          // always include end point
          const endLook = computeSatLookAngles(sat.satrec, observerGd, new Date(endMs));
          if (endLook) {
            points.push({ azimuth: endLook.azimuth, elevation: endLook.elevation });
          }

          if (points.length >= 2) {
            arcs.push({
              color: getSatelliteColor(sat, colorMode),
              points,
            });
          }
        }
      } catch {
        // skip failed predictions
      }
    }

    passArcsRef.current = arcs;
    lastPassUpdateRef.current = Date.now();
  }, []);

  // main animation loop
  const animate = useCallback(() => {
    if (!active) return;

    const now = Date.now();
    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    // throttle to ~15fps
    if (now - lastFrameRef.current < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }
    lastFrameRef.current = now;

    const ctx = canvas.getContext('2d');
    const { cx, cy, radius, w, h } = layoutRef.current;
    if (!w || !h || !observerLocation) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const simTime = getSimTime();
    const colorMode = useSatelliteStore.getState().colorMode;
    const detailId = useSatelliteStore.getState().detailSatelliteId;

    const observerGd = {
      longitude: observerLocation.lon * DEG2RAD,
      latitude: observerLocation.lat * DEG2RAD,
      height: 0,
    };

    // compute visible sats
    visibleSatsRef.current = getVisibleSatellites(observerGd, simTime, colorMode);

    // update star canvas every 30s
    if (now - lastStarDrawRef.current > STAR_UPDATE_INTERVAL) {
      updateStarCanvas(simTime);
    }

    // update pass arcs every 5min
    if (now - lastPassUpdateRef.current > PASS_UPDATE_INTERVAL) {
      updatePassArcs(observerGd, simTime);
    }

    // draw frame
    drawBackground(ctx, w, h, cx, cy, radius);
    drawGrid(ctx, cx, cy, radius);

    // composite cached star layer
    if (starCanvasRef.current) {
      ctx.drawImage(starCanvasRef.current, 0, 0);
    }

    // draw pass arcs
    drawPassArcs(ctx, cx, cy, radius, passArcsRef.current);

    // draw sats
    drawSatellites(ctx, cx, cy, radius, visibleSatsRef.current, highlightedRef.current, detailId);

    // info text at top
    ctx.save();
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(
      `SKY DOME  |  ${observerLocation.label || `${observerLocation.lat.toFixed(2)}, ${observerLocation.lon.toFixed(2)}`}  |  ${visibleSatsRef.current.length} visible`,
      w / 2,
      24
    );
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('ESC to exit', w / 2, h - 16);
    ctx.restore();

    rafRef.current = requestAnimationFrame(animate);
  }, [active, observerLocation, updateStarCanvas, updatePassArcs]);

  // handle canvas resize
  useEffect(() => {
    if (!active) return;

    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      updateLayout();

      // force star redraw on resize
      lastStarDrawRef.current = 0;
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [active, updateLayout]);

  // start/stop animation loop
  useEffect(() => {
    if (!active || !observerLocation) return;

    updateLayout();

    // initial star draw
    const simTime = getSimTime();
    updateStarCanvas(simTime);

    // initial pass arc computation
    const observerGd = {
      longitude: observerLocation.lon * DEG2RAD,
      latitude: observerLocation.lat * DEG2RAD,
      height: 0,
    };
    updatePassArcs(observerGd, simTime);

    // start animation
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, observerLocation, animate, updateLayout, updateStarCanvas, updatePassArcs]);

  // escape key handler
  useEffect(() => {
    if (!active) return;

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCameraMode('free');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, setCameraMode]);

  // mouse interaction
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { cx, cy, radius } = layoutRef.current;

    const id = hitTest(x, y, visibleSatsRef.current, cx, cy, radius);
    highlightedRef.current = id;
    setHighlightedId(id);
    canvas.style.cursor = id !== null ? 'pointer' : 'default';
  }, []);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { cx, cy, radius } = layoutRef.current;

    const id = hitTest(x, y, visibleSatsRef.current, cx, cy, radius);
    if (id !== null) {
      useSatelliteStore.getState().setDetailSatelliteId(id);
    }
  }, []);

  if (!active) return null;

  // no observer location, show prompt
  if (!observerLocation) {
    return (
      <div
        className="fixed inset-0 z-20 flex items-center justify-center"
        style={{ background: '#050510' }}
      >
        <div className="text-center">
          <p
            className="text-sm mb-4"
            style={{ color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}
          >
            Set an observer location to use Sky Dome view
          </p>
          <button
            onClick={() => {
              setCameraMode('free');
              useAppStore.getState().openLocationPrompt();
            }}
            className="glass rounded-lg px-5 py-2.5 text-xs transition-all duration-200 hover:bg-[var(--glass-hover)]"
            style={{ color: 'var(--accent)', fontFamily: '"JetBrains Mono", monospace' }}
          >
            Set Location
          </button>
          <p
            className="text-[10px] mt-4"
            style={{ color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}
          >
            ESC to exit
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-20"
      style={{ background: '#050510' }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
