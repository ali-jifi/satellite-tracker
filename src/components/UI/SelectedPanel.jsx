import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Info, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import useSatelliteStore from '../../stores/satelliteStore';
import { CATEGORY_COLORS } from '../../utils/colorModes.js';

const MAX_SELECTED = 20;
const STRIDE = 5;
const ALTITUDE_REFRESH_MS = 2000;

function useSelectedPositions() {
  const [positions, setPositions] = useState(new Map());

  useEffect(() => {
    function update() {
      const { positionBuffer, positionCount, selectedIds } = useSatelliteStore.getState();
      if (!positionBuffer || positionCount === 0 || selectedIds.size === 0) return;
      const buf = new Float64Array(positionBuffer);
      const next = new Map();
      for (let i = 0; i < positionCount; i++) {
        const offset = i * STRIDE;
        const id = buf[offset];
        if (selectedIds.has(id)) {
          next.set(id, {
            lat: buf[offset + 1],
            lon: buf[offset + 2],
            alt: buf[offset + 3],
            speed: buf[offset + 4],
          });
        }
      }
      setPositions(next);
    }

    update();
    const iv = setInterval(update, ALTITUDE_REFRESH_MS);
    return () => clearInterval(iv);
  }, []);

  return positions;
}

function SelectedSatelliteRow({ satellite, onDeselect, position }) {
  const [showInfo, setShowInfo] = useState(false);
  const color = CATEGORY_COLORS[satellite.category] || '#cccccc';

  return (
    <div className="mb-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[var(--glass-hover)] transition-colors duration-100">
        {/* Color dot */}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Name */}
        <span
          className="text-[11px] flex-1 truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {satellite.name}
        </span>

        {/* Info toggle */}
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-0.5 rounded hover:bg-[var(--glass-hover)]"
          title="Satellite info"
        >
          {showInfo ? (
            <ChevronUp size={11} style={{ color: 'var(--accent)' }} />
          ) : (
            <Info size={11} style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>

        {/* Deselect */}
        <button
          onClick={() => onDeselect(satellite.id)}
          className="p-0.5 rounded hover:bg-[var(--glass-hover)]"
          title="Deselect"
        >
          <X size={11} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Expanded info */}
      {showInfo && (
        <div className="ml-5 mr-2 mb-2 px-2 py-1.5 rounded bg-black/20 border border-white/5">
          <InfoGrid satellite={satellite} position={position} />
        </div>
      )}
    </div>
  );
}

function InfoGrid({ satellite, position }) {
  const rows = [
    ['NORAD ID', satellite.id],
    ['Category', satellite.category || 'N/A'],
    ['Country', satellite.countryCode || 'N/A'],
    ['Latitude', position ? `${position.lat.toFixed(2)}deg` : '--'],
    ['Longitude', position ? `${position.lon.toFixed(2)}deg` : '--'],
    ['Altitude', position ? `${position.alt.toFixed(1)} km` : '--'],
    ['Velocity', position ? `${(position.speed * 3600).toFixed(0)} km/h (${position.speed.toFixed(2)} km/s)` : '--'],
    ['Inclination', satellite.inclination != null ? `${satellite.inclination.toFixed(2)}deg` : 'N/A'],
    ['Period', satellite.period != null ? `${satellite.period.toFixed(1)} min` : 'N/A'],
    ['Apogee', satellite.apogee != null ? `${satellite.apogee.toFixed(1)} km` : 'N/A'],
    ['Perigee', satellite.perigee != null ? `${satellite.perigee.toFixed(1)} km` : 'N/A'],
  ];

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between">
          <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
          <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SelectedPanel() {
  const selectedIds = useSatelliteStore((s) => s.selectedIds);
  const satellites = useSatelliteStore((s) => s.satellites);
  const deselectSatellite = useSatelliteStore((s) => s.deselectSatellite);
  const clearSelection = useSatelliteStore((s) => s.clearSelection);
  const positions = useSelectedPositions();

  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedSats = [];
  for (const id of selectedIds) {
    const sat = satellites.get(id);
    if (sat) selectedSats.push(sat);
  }

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-[10px] tracking-[0.2em] uppercase"
          style={{ color: 'var(--accent)', fontWeight: 600 }}
        >
          Selected ({count}/{MAX_SELECTED})
        </h3>
        <button
          onClick={clearSelection}
          className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border border-white/10 hover:bg-[var(--glass-hover)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Trash2 size={9} />
          Clear All
        </button>
      </div>

      {/* List */}
      <div>
        {selectedSats.map((sat) => (
          <SelectedSatelliteRow
            key={sat.id}
            satellite={sat}
            onDeselect={deselectSatellite}
            position={positions.get(sat.id)}
          />
        ))}
      </div>
    </div>
  );
}
