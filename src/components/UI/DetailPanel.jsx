import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import * as satellite from 'satellite.js';
import useSatelliteStore from '../../stores/satelliteStore';
import useAppStore from '../../stores/appStore';
import { findPasses } from '../../utils/passPredictor';

const STRIDE = 5;
const UPDATE_MS = 1000;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Recompute passes if sim time drifts more than 1 hour from last computation
const RECOMPUTE_DRIFT_MS = 3600000;
// Recompute every 5 minutes of sim time
const RECOMPUTE_INTERVAL_MS = 300000;

const COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function azimuthToCompass(deg) {
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return COMPASS_DIRS[idx];
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimeUTC(date) {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function SectionLabel({ children }) {
  return (
    <div
      className="text-[9px] tracking-[0.15em] uppercase mb-1.5 mt-3 first:mt-0"
      style={{ color: 'var(--accent)', fontWeight: 600 }}
    >
      {children}
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="flex justify-between py-[1px]">
      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function formatLat(deg) {
  const abs = Math.abs(deg).toFixed(4);
  return `${abs}\u00B0 ${deg >= 0 ? 'N' : 'S'}`;
}

function formatLon(deg) {
  const abs = Math.abs(deg).toFixed(4);
  return `${abs}\u00B0 ${deg >= 0 ? 'E' : 'W'}`;
}

/**
 * Compute range (km) and elevation (deg) from observer to satellite.
 * Uses satellite.js ecfToLookAngles.
 */
function computeLookAngles(sat, simTime) {
  const observer = useAppStore.getState().observerLocation;
  if (!observer || !sat.satrec) return null;

  try {
    const gmst = satellite.gstime(simTime);
    const posVel = satellite.propagate(sat.satrec, simTime);
    if (!posVel.position) return null;

    const ecf = satellite.eciToEcf(posVel.position, gmst);
    const observerGd = {
      longitude: observer.lon * DEG2RAD,
      latitude: observer.lat * DEG2RAD,
      height: 0,
    };
    const lookAngles = satellite.ecfToLookAngles(observerGd, ecf);

    return {
      range: lookAngles.rangeSat,
      elevation: lookAngles.elevation * RAD2DEG,
    };
  } catch {
    return null;
  }
}

function getSimTime() {
  const viewer = useAppStore.getState().viewerRef;
  if (viewer && viewer.clock) {
    const julianDate = viewer.clock.currentTime;
    // Convert CesiumJS JulianDate to JS Date
    const epoch = window.Cesium
      ? window.Cesium.JulianDate.toDate(julianDate)
      : new Date();
    return epoch;
  }
  return new Date();
}

function useLiveTelemetry(satId, sat) {
  const [telemetry, setTelemetry] = useState(null);

  useEffect(() => {
    if (!satId || !sat) {
      setTelemetry(null);
      return;
    }

    function update() {
      const { positionBuffer, positionCount } = useSatelliteStore.getState();
      if (!positionBuffer || positionCount === 0) return;

      const buf = new Float64Array(positionBuffer);
      let lat = null, lon = null, alt = null, speed = null;

      for (let i = 0; i < positionCount; i++) {
        const offset = i * STRIDE;
        if (buf[offset] === satId) {
          lat = buf[offset + 1];
          lon = buf[offset + 2];
          alt = buf[offset + 3];
          speed = buf[offset + 4];
          break;
        }
      }

      if (lat === null) {
        setTelemetry(null);
        return;
      }

      const simTime = getSimTime();
      const look = computeLookAngles(sat, simTime);

      setTelemetry({
        lat,
        lon,
        alt,
        speed,
        range: look ? look.range : null,
        elevation: look ? look.elevation : null,
      });
    }

    update();
    const iv = setInterval(update, UPDATE_MS);
    return () => clearInterval(iv);
  }, [satId, sat]);

  return telemetry;
}

/**
 * Hook to compute and manage pass predictions for a satellite.
 * Recomputes on satellite change, observer change, and sim time drift.
 */
function usePassPredictions(satId, sat) {
  const [passes, setPasses] = useState(null);
  const [computing, setComputing] = useState(false);
  const lastComputeTimeRef = useRef(null);
  const observerLocation = useAppStore((s) => s.observerLocation);

  const computePasses = useCallback(async () => {
    if (!sat || !sat.satrec || !observerLocation) {
      setPasses(null);
      return;
    }

    setComputing(true);
    try {
      const simTime = getSimTime();
      const observerGd = {
        longitude: observerLocation.lon * DEG2RAD,
        latitude: observerLocation.lat * DEG2RAD,
        height: 0,
      };

      const result = await findPasses(sat.satrec, observerGd, simTime, {
        maxPasses: 5,
        maxHours: 24,
        minElevation: 5,
      });

      setPasses(result);
      lastComputeTimeRef.current = simTime.getTime();
    } catch {
      setPasses([]);
    }
    setComputing(false);
  }, [sat, observerLocation]);

  // Recompute when satellite or observer changes
  useEffect(() => {
    if (satId != null && sat && observerLocation) {
      computePasses();
    } else {
      setPasses(null);
      lastComputeTimeRef.current = null;
    }
  }, [satId, sat, observerLocation, computePasses]);

  // Periodic recomputation check (every 10 seconds wall time)
  useEffect(() => {
    if (!satId || !sat || !observerLocation) return;

    const checkInterval = setInterval(() => {
      const simNow = getSimTime().getTime();
      const lastCompute = lastComputeTimeRef.current;
      if (lastCompute == null) return;

      const drift = Math.abs(simNow - lastCompute);
      if (drift > RECOMPUTE_DRIFT_MS || drift > RECOMPUTE_INTERVAL_MS) {
        computePasses();
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [satId, sat, observerLocation, computePasses]);

  return { passes, computing };
}

/**
 * Hook to provide a ticking countdown value based on simulation time.
 */
function useSimCountdown(passes) {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (!passes || passes.length === 0) {
      setCountdown(null);
      return;
    }

    function tick() {
      const simNow = getSimTime();
      const simMs = simNow.getTime();

      // Check if currently overhead
      for (const pass of passes) {
        if (simMs >= pass.start.getTime() && simMs <= pass.end.getTime()) {
          // Currently in pass
          const currentLook = computeLookAnglesForPass(pass, simNow);
          setCountdown({
            type: 'overhead',
            pass,
            elevation: currentLook,
            remaining: pass.end.getTime() - simMs,
          });
          return;
        }
      }

      // Find next future pass
      const nextPass = passes.find((p) => p.start.getTime() > simMs);
      if (nextPass) {
        setCountdown({
          type: 'countdown',
          pass: nextPass,
          remaining: nextPass.start.getTime() - simMs,
        });
      } else {
        setCountdown(null);
      }
    }

    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [passes]);

  return countdown;
}

/** Approximate elevation during a pass at a given time (linear interpolation) */
function computeLookAnglesForPass(pass, simTime) {
  const t = simTime.getTime();
  const midT = pass.maxElevationTime.getTime();
  const startT = pass.start.getTime();
  const endT = pass.end.getTime();

  if (t <= startT) return 0;
  if (t >= endT) return 0;

  // Simple approximation: parabolic between start/max/end
  if (t <= midT) {
    const frac = (t - startT) / (midT - startT);
    return pass.maxElevation * frac;
  } else {
    const frac = (endT - t) / (endT - midT);
    return pass.maxElevation * frac;
  }
}

function PassCountdown({ countdown }) {
  if (!countdown) {
    return (
      <div
        className="text-[11px] py-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        No passes in next 24h
      </div>
    );
  }

  if (countdown.type === 'overhead') {
    return (
      <div className="py-1">
        <div
          className="text-lg font-bold tabular-nums"
          style={{ color: 'var(--accent)' }}
        >
          OVERHEAD NOW
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          El {countdown.elevation != null ? `${countdown.elevation.toFixed(1)}\u00B0` : '--'}
          {' \u2022 '}
          {formatCountdown(countdown.remaining)} remaining
        </div>
      </div>
    );
  }

  return (
    <div className="py-1">
      <div
        className="text-lg font-bold tabular-nums"
        style={{ color: 'var(--accent)' }}
      >
        T-{formatCountdown(countdown.remaining)}
      </div>
      <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        Max {countdown.pass.maxElevation.toFixed(1)}{'\u00B0'}
        {' \u2022 '}
        {formatDuration(countdown.pass.duration)}
        {' \u2022 '}
        {azimuthToCompass(countdown.pass.startAzimuth)}{'\u2192'}{azimuthToCompass(countdown.pass.maxAzimuth)}
      </div>
    </div>
  );
}

function PassList({ passes, countdown }) {
  if (!passes || passes.length === 0) return null;

  const simNow = getSimTime().getTime();

  return (
    <div className="mt-1.5 space-y-[2px]">
      {passes.map((pass, i) => {
        const isNext = countdown &&
          countdown.type === 'countdown' &&
          countdown.pass === pass;
        const isOverhead = countdown &&
          countdown.type === 'overhead' &&
          countdown.pass === pass;
        const isPast = pass.end.getTime() < simNow;

        return (
          <div
            key={i}
            className="flex items-center gap-2 px-1.5 py-0.5 rounded"
            style={{
              background: isNext || isOverhead ? 'rgba(56, 243, 191, 0.08)' : 'transparent',
              borderLeft: isNext || isOverhead ? '2px solid var(--accent)' : '2px solid transparent',
              opacity: isPast ? 0.4 : 1,
            }}
          >
            <span
              className="text-[10px] tabular-nums w-[36px] flex-shrink-0"
              style={{ color: 'var(--text-primary)' }}
            >
              {formatTimeUTC(pass.start)}
            </span>
            <span
              className="text-[10px] tabular-nums w-[40px] flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}
            >
              {formatDuration(pass.duration)}
            </span>
            <span
              className="text-[10px] tabular-nums w-[32px] flex-shrink-0"
              style={{ color: 'var(--text-primary)' }}
            >
              {pass.maxElevation.toFixed(1)}{'\u00B0'}
            </span>
            <span
              className="text-[10px] flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}
            >
              {azimuthToCompass(pass.startAzimuth)}{'\u2192'}{azimuthToCompass(pass.maxAzimuth)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DetailPanel() {
  const detailSatelliteId = useSatelliteStore((s) => s.detailSatelliteId);
  const satellites = useSatelliteStore((s) => s.satellites);
  const clearDetail = useSatelliteStore((s) => s.clearDetailSatelliteId);

  const sat = detailSatelliteId != null ? satellites.get(detailSatelliteId) : null;
  const telemetry = useLiveTelemetry(detailSatelliteId, sat);
  const { passes, computing } = usePassPredictions(detailSatelliteId, sat);
  const countdown = useSimCountdown(passes);
  const observerLocation = useAppStore((s) => s.observerLocation);

  if (!sat) return null;

  // Eccentricity from satrec
  const eccentricity = sat.satrec ? sat.satrec.ecco : null;

  return (
    <div
      className="glass fixed z-30 overflow-y-auto"
      style={{
        bottom: 16,
        right: 16,
        width: 320,
        maxHeight: '60vh',
        borderRadius: 8,
      }}
    >
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {sat.name}
            </div>
            <div
              className="text-[10px] tabular-nums"
              style={{ color: 'var(--text-secondary)' }}
            >
              NORAD {sat.id}
            </div>
          </div>
          <button
            onClick={clearDetail}
            className="p-0.5 rounded hover:bg-[var(--glass-hover)] flex-shrink-0"
            title="Close detail"
          >
            <X size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Position */}
        <SectionLabel>Position</SectionLabel>
        <DataRow label="Lat" value={telemetry ? formatLat(telemetry.lat) : '--'} />
        <DataRow label="Lon" value={telemetry ? formatLon(telemetry.lon) : '--'} />
        <DataRow
          label="Alt"
          value={telemetry ? `${telemetry.alt.toFixed(1)} km` : '--'}
        />

        {/* Telemetry */}
        <SectionLabel>Telemetry</SectionLabel>
        <DataRow
          label="Velocity"
          value={
            telemetry && telemetry.speed != null
              ? `${telemetry.speed.toFixed(1)} km/s (${(telemetry.speed * 3600).toFixed(0)} km/h)`
              : '--'
          }
        />
        <DataRow
          label="Range"
          value={
            telemetry && telemetry.range != null
              ? `${telemetry.range.toFixed(1)} km`
              : '--'
          }
        />
        <DataRow
          label="Elevation"
          value={
            telemetry && telemetry.elevation != null
              ? `${telemetry.elevation.toFixed(1)}\u00B0`
              : '--'
          }
        />

        {/* Next Pass */}
        <SectionLabel>Next Pass</SectionLabel>
        {!observerLocation ? (
          <div
            className="text-[11px] py-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Set observer location to see pass predictions
          </div>
        ) : computing && !passes ? (
          <div
            className="text-[11px] py-1"
            style={{ color: 'var(--accent)', opacity: 0.7 }}
          >
            Calculating...
          </div>
        ) : (
          <>
            <PassCountdown countdown={countdown} />
            <PassList passes={passes} countdown={countdown} />
          </>
        )}

        {/* Orbit Data */}
        <SectionLabel>Orbit</SectionLabel>
        <DataRow
          label="Inclination"
          value={sat.inclination != null ? `${sat.inclination.toFixed(2)}\u00B0` : 'N/A'}
        />
        <DataRow
          label="Period"
          value={sat.period != null ? `${sat.period.toFixed(1)} min` : 'N/A'}
        />
        <DataRow
          label="Eccentricity"
          value={eccentricity != null ? eccentricity.toFixed(4) : 'N/A'}
        />
        <DataRow
          label="Apogee"
          value={sat.apogee != null ? `${sat.apogee.toFixed(1)} km` : 'N/A'}
        />
        <DataRow
          label="Perigee"
          value={sat.perigee != null ? `${sat.perigee.toFixed(1)} km` : 'N/A'}
        />

        {/* Object Info */}
        <SectionLabel>Object</SectionLabel>
        <DataRow label="Launch" value={sat.launchDate || 'N/A'} />
        <DataRow label="Country" value={sat.countryCode || 'N/A'} />
        <DataRow label="Type" value={sat.objectType || sat.category || 'N/A'} />
      </div>
    </div>
  );
}
