import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Info, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import useSatelliteStore from '../../stores/satelliteStore';
import { CATEGORY_COLORS } from '../../utils/colorModes.js';

const MAX_SELECTED = 20;
const STRIDE = 5;

function SelectedSatelliteRow({ satellite, onDeselect }) {
  const detailSatelliteId = useSatelliteStore((s) => s.detailSatelliteId);
  const isDetailActive = detailSatelliteId === satellite.id;
  const color = CATEGORY_COLORS[satellite.category] || '#cccccc';

  const handleInfoClick = () => {
    const store = useSatelliteStore.getState();
    if (store.detailSatelliteId === satellite.id) {
      store.clearDetailSatelliteId();
    } else {
      store.setDetailSatelliteId(satellite.id);
    }
  };

  return (
    <div className="mb-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[var(--glass-hover)] transition-colors duration-100">
        {/* color dot */}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* name */}
        <span
          className="text-[11px] flex-1 truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {satellite.name}
        </span>

        {/* info toggle */}
        <button
          onClick={handleInfoClick}
          className="p-0.5 rounded hover:bg-[var(--glass-hover)]"
          title="Satellite detail"
        >
          <Info
            size={11}
            style={{ color: isDetailActive ? 'var(--accent)' : 'var(--text-secondary)' }}
          />
        </button>

        {/* deselect */}
        <button
          onClick={() => onDeselect(satellite.id)}
          className="p-0.5 rounded hover:bg-[var(--glass-hover)]"
          title="Deselect"
        >
          <X size={11} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </div>
  );
}

export default function SelectedPanel() {
  const selectedIds = useSatelliteStore((s) => s.selectedIds);
  const satellites = useSatelliteStore((s) => s.satellites);
  const deselectSatellite = useSatelliteStore((s) => s.deselectSatellite);
  const clearSelection = useSatelliteStore((s) => s.clearSelection);

  const handleDeselect = useCallback((id) => {
    // if detail panel shows this sat, close it
    if (useSatelliteStore.getState().detailSatelliteId === id) {
      useSatelliteStore.getState().clearDetailSatelliteId();
    }
    deselectSatellite(id);
  }, [deselectSatellite]);

  const handleClearAll = useCallback(() => {
    useSatelliteStore.getState().clearDetailSatelliteId();
    clearSelection();
  }, [clearSelection]);

  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedSats = [];
  for (const id of selectedIds) {
    const sat = satellites.get(id);
    if (sat) selectedSats.push(sat);
  }

  return (
    <div className="mb-4">
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-[10px] tracking-[0.2em] uppercase"
          style={{ color: 'var(--accent)', fontWeight: 600 }}
        >
          Selected ({count}/{MAX_SELECTED})
        </h3>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border border-white/10 hover:bg-[var(--glass-hover)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Trash2 size={9} />
          Clear All
        </button>
      </div>

      {/* list */}
      <div>
        {selectedSats.map((sat) => (
          <SelectedSatelliteRow
            key={sat.id}
            satellite={sat}
            onDeselect={handleDeselect}
          />
        ))}
      </div>
    </div>
  );
}
