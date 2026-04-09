import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import * as satellite from 'satellite.js';
import useSatelliteStore from '../../stores/satelliteStore';
import useAppStore from '../../stores/appStore';

const STRIDE = 5;
const UPDATE_MS = 1000;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

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

export default function DetailPanel() {
  const detailSatelliteId = useSatelliteStore((s) => s.detailSatelliteId);
  const satellites = useSatelliteStore((s) => s.satellites);
  const clearDetail = useSatelliteStore((s) => s.clearDetailSatelliteId);

  const sat = detailSatelliteId != null ? satellites.get(detailSatelliteId) : null;
  const telemetry = useLiveTelemetry(detailSatelliteId, sat);

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

        {/* Next Pass placeholder */}
        <SectionLabel>Next Pass</SectionLabel>
        <div
          className="text-[11px] py-1"
          style={{ color: 'var(--accent)', opacity: 0.7 }}
        >
          Calculating...
        </div>

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
