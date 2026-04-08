import { useState, useCallback, useRef, useMemo } from 'react';
import { ChevronRight, ChevronDown, Filter, FilterX } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import useSatelliteStore from '../../stores/satelliteStore';
import { CATEGORY_COLORS } from '../../utils/colorModes.js';
import SatelliteCard from './SatelliteCard';

// Human-readable display names for CelesTrak groups
const CATEGORY_DISPLAY = {
  'active': 'Active Satellites',
  'stations': 'Space Stations',
  'visual': 'Brightest / Visual',
  'starlink': 'Starlink',
  'oneweb': 'OneWeb',
  'gps-ops': 'GPS (Operational)',
  'glonass-ops': 'GLONASS (Operational)',
  'galileo': 'Galileo',
  'beidou': 'BeiDou',
  'weather': 'Weather',
  'noaa': 'NOAA',
  'goes': 'GOES',
  'science': 'Science',
  'geodetic': 'Geodetic',
  'engineering': 'Engineering',
  'education': 'Education',
  'military': 'Military',
  'radar': 'Radar',
  'amateur': 'Amateur Radio',
  'satnogs': 'SatNOGS',
  'iridium': 'Iridium',
  'iridium-NEXT': 'Iridium NEXT',
  'orbcomm': 'ORBCOMM',
  'globalstar': 'Globalstar',
  'swarm': 'Swarm',
  'intelsat': 'Intelsat',
  'ses': 'SES',
  'other-comm': 'Other Comm',
  'x-comm': 'Experimental Comm',
  'geo': 'Geostationary',
  'resource': 'Earth Resources',
  'sarsat': 'SARSAT',
  'dmc': 'DMC',
  'tdrss': 'TDRSS',
  'argos': 'ARGOS',
  'gnss': 'GNSS',
  'cubesat': 'CubeSats',
  'musson': 'Musson',
  'gorizont': 'Gorizont',
  'raduga': 'Raduga',
  'molniya': 'Molniya',
  'other': 'Other',
};

function CategoryNode({ category, satellites, activeFilter, onSolo, onClearFilter }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const selectedIds = useSatelliteStore((s) => s.selectedIds);
  const parentRef = useRef(null);

  const displayName = CATEGORY_DISPLAY[category] || category;
  const color = CATEGORY_COLORS[category] || '#cccccc';
  const count = satellites.length;
  const isSolo = activeFilter?.type === 'category' && activeFilter?.value === category;

  // Group by country
  const byCountry = useMemo(() => {
    const map = new Map();
    for (const sat of satellites) {
      const cc = sat.countryCode || 'UNK';
      if (!map.has(cc)) map.set(cc, []);
      map.get(cc).push(sat);
    }
    // Sort countries by count desc
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [satellites]);

  const toggleCountry = useCallback((cc) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(cc)) next.delete(cc);
      else next.add(cc);
      return next;
    });
  }, []);

  const handleSelect = useCallback((id) => {
    const store = useSatelliteStore.getState();
    if (store.selectedIds.has(id)) {
      store.deselectSatellite(id);
    } else {
      store.selectSatellite(id);
    }
  }, []);

  const handleSolo = useCallback((e) => {
    e.stopPropagation();
    if (isSolo) {
      onClearFilter();
    } else {
      onSolo({ type: 'category', value: category });
    }
  }, [isSolo, category, onSolo, onClearFilter]);

  const handleCountrySolo = useCallback((e, cc) => {
    e.stopPropagation();
    const isCountrySolo = activeFilter?.type === 'country' && activeFilter?.value === cc;
    if (isCountrySolo) {
      onClearFilter();
    } else {
      onSolo({ type: 'country', value: cc });
    }
  }, [activeFilter, onSolo, onClearFilter]);

  return (
    <div className="mb-0.5">
      {/* Category header */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors duration-100 ${
          isSolo ? 'bg-[var(--accent-glow)]' : 'hover:bg-[var(--glass-hover)]'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={12} style={{ color: 'var(--text-secondary)' }} />
        ) : (
          <ChevronRight size={12} style={{ color: 'var(--text-secondary)' }} />
        )}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
          {displayName}
        </span>
        <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {count.toLocaleString()}
        </span>
        {isSolo && (
          <span
            className="text-[7px] px-1 py-px rounded-sm uppercase tracking-wider"
            style={{ backgroundColor: 'var(--accent)', color: '#000' }}
          >
            active
          </span>
        )}
        <button
          onClick={handleSolo}
          className="p-0.5 rounded hover:bg-[var(--glass-hover)]"
          title={isSolo ? 'Show all' : 'Solo this category'}
        >
          {isSolo ? (
            <FilterX size={10} style={{ color: 'var(--accent)' }} />
          ) : (
            <Filter size={10} style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>
      </div>

      {/* Expanded: country groups */}
      {expanded && (
        <div className="ml-4 mt-0.5">
          {byCountry.map(([cc, sats]) => {
            const isCountryExpanded = expandedCountries.has(cc);
            const isCountrySolo = activeFilter?.type === 'country' && activeFilter?.value === cc;

            return (
              <div key={cc} className="mb-0.5">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors duration-100 ${
                    isCountrySolo ? 'bg-[var(--accent-glow)]' : 'hover:bg-[var(--glass-hover)]'
                  }`}
                  onClick={() => toggleCountry(cc)}
                >
                  {isCountryExpanded ? (
                    <ChevronDown size={10} style={{ color: 'var(--text-secondary)' }} />
                  ) : (
                    <ChevronRight size={10} style={{ color: 'var(--text-secondary)' }} />
                  )}
                  <span className="text-[10px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                    {cc}
                  </span>
                  <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {sats.length.toLocaleString()}
                  </span>
                  <button
                    onClick={(e) => handleCountrySolo(e, cc)}
                    className="p-0.5 rounded hover:bg-[var(--glass-hover)]"
                    title={isCountrySolo ? 'Show all' : 'Solo this country'}
                  >
                    {isCountrySolo ? (
                      <FilterX size={9} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <Filter size={9} style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </button>
                </div>

                {/* Satellite list with virtual scrolling for large sets */}
                {isCountryExpanded && (
                  <CountrySatelliteList
                    satellites={sats}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CountrySatelliteList({ satellites, selectedIds, onSelect }) {
  const parentRef = useRef(null);
  const useVirtual = satellites.length > 100;

  const sorted = useMemo(
    () => [...satellites].sort((a, b) => a.id - b.id),
    [satellites]
  );

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38,
    overscan: 10,
    enabled: useVirtual,
  });

  if (useVirtual) {
    return (
      <div
        ref={parentRef}
        className="ml-3 mt-0.5 max-h-60 overflow-y-auto custom-scroll"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const sat = sorted[vItem.index];
            return (
              <div
                key={sat.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${vItem.size}px`,
                  transform: `translateY(${vItem.start}px)`,
                }}
              >
                <SatelliteCard
                  satellite={sat}
                  onSelect={onSelect}
                  isSelected={selectedIds.has(sat.id)}
                  showAltitude={false}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="ml-3 mt-0.5">
      {sorted.map((sat) => (
        <SatelliteCard
          key={sat.id}
          satellite={sat}
          onSelect={onSelect}
          isSelected={selectedIds.has(sat.id)}
          showAltitude={false}
        />
      ))}
    </div>
  );
}

export default function CategoryTree() {
  const categoryIndex = useSatelliteStore((s) => s.categoryIndex);
  const satellites = useSatelliteStore((s) => s.satellites);
  const activeFilter = useSatelliteStore((s) => s.activeFilter);
  const setFilter = useSatelliteStore((s) => s.setFilter);
  const clearFilter = useSatelliteStore((s) => s.clearFilter);

  // Build sorted category list with satellite arrays
  const categories = useMemo(() => {
    const result = [];
    for (const [cat, ids] of categoryIndex.entries()) {
      const sats = [];
      for (const id of ids) {
        const sat = satellites.get(id);
        if (sat) sats.push(sat);
      }
      if (sats.length > 0) {
        result.push({ category: cat, satellites: sats });
      }
    }
    // Sort by count desc
    result.sort((a, b) => b.satellites.length - a.satellites.length);
    return result;
  }, [categoryIndex, satellites]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-[10px] tracking-[0.2em] uppercase"
          style={{ color: 'var(--accent)', fontWeight: 600 }}
        >
          Categories
        </h3>
        {activeFilter && (
          <button
            onClick={clearFilter}
            className="text-[9px] px-2 py-0.5 rounded border border-[var(--accent)]/30 hover:bg-[var(--glass-hover)] transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            Show All
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="space-y-0">
        {categories.map(({ category, satellites: sats }) => (
          <CategoryNode
            key={category}
            category={category}
            satellites={sats}
            activeFilter={activeFilter}
            onSolo={setFilter}
            onClearFilter={clearFilter}
          />
        ))}
      </div>
    </div>
  );
}
