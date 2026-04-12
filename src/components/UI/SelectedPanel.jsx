import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import useSatelliteStore from '../../stores/satelliteStore';
import { CATEGORY_COLORS } from '../../utils/colorModes.js';

const MAX_SELECTED = 20;

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
    <div className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[var(--glass-hover)] transition-colors duration-100 group">
      {/* color dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* name */}
      <span
        className="text-[11px] flex-1 truncate cursor-default"
        style={{ color: 'var(--text-primary)' }}
      >
        {satellite.name}
      </span>

      {/* info toggle */}
      <button
        onClick={handleInfoClick}
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--glass-hover)] transition-opacity"
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
  );
}

export default function SelectedPanel() {
  const selectedIds = useSatelliteStore((s) => s.selectedIds);
  const satellites = useSatelliteStore((s) => s.satellites);
  const deselectSatellite = useSatelliteStore((s) => s.deselectSatellite);
  const clearSelection = useSatelliteStore((s) => s.clearSelection);

  // drag state
  const [pos, setPos] = useState({ x: 16, y: 64 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const cardRef = useRef(null);

  const handleDeselect = useCallback((id) => {
    if (useSatelliteStore.getState().detailSatelliteId === id) {
      useSatelliteStore.getState().clearDetailSatelliteId();
    }
    deselectSatellite(id);
  }, [deselectSatellite]);

  const handleClearAll = useCallback(() => {
    useSatelliteStore.getState().clearDetailSatelliteId();
    clearSelection();
  }, [clearSelection]);

  // drag handlers
  const onPointerDown = useCallback((e) => {
    // only drag from the header area
    if (e.target.closest('button')) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    setPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedSats = [];
  for (const id of selectedIds) {
    const sat = satellites.get(id);
    if (sat) selectedSats.push(sat);
  }

  return (
    <div
      ref={cardRef}
      className="fixed z-40 glass rounded-lg shadow-lg"
      style={{
        left: pos.x,
        top: pos.y,
        minWidth: 200,
        maxWidth: 280,
        userSelect: 'none',
      }}
    >
      {/* draggable header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing"
        style={{ borderBottom: '1px solid var(--glass-border)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span
          className="text-[10px] tracking-[0.15em] uppercase"
          style={{ color: 'var(--text-secondary)', fontWeight: 600 }}
        >
          Selected ({count})
        </span>
        <button
          onClick={handleClearAll}
          className="text-[9px] px-1.5 py-0.5 rounded hover:bg-[var(--glass-hover)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          clear all
        </button>
      </div>

      {/* sat list */}
      <div className="py-1 max-h-[300px] overflow-y-auto custom-scroll">
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
