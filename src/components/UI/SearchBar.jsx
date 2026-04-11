import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import useSatelliteStore from '../../stores/satelliteStore';
import SatelliteCard from './SatelliteCard';

const DEBOUNCE_MS = 200;
const ALTITUDE_REFRESH_MS = 2000;
const STRIDE = 5; // Float64Array layout: [id, lat, lon, alt, speed]

function useAltitudeMap() {
  const [altMap, setAltMap] = useState(new Map());

  useEffect(() => {
    function update() {
      const { positionBuffer, positionCount } = useSatelliteStore.getState();
      if (!positionBuffer || positionCount === 0) return;
      const buf = new Float64Array(positionBuffer);
      const next = new Map();
      for (let i = 0; i < positionCount; i++) {
        const offset = i * STRIDE;
        const id = buf[offset];
        const alt = buf[offset + 3];
        next.set(id, alt);
      }
      setAltMap(next);
    }

    update();
    const iv = setInterval(update, ALTITUDE_REFRESH_MS);
    return () => clearInterval(iv);
  }, []);

  return altMap;
}

export default function SearchBar() {
  const searchQuery = useSatelliteStore((s) => s.searchQuery);
  const searchResults = useSatelliteStore((s) => s.searchResults);
  const selectedIds = useSatelliteStore((s) => s.selectedIds);
  const setSearchQuery = useSatelliteStore((s) => s.setSearchQuery);

  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef(null);
  const parentRef = useRef(null);

  const altMap = useAltitudeMap();

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setLocalQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val);
    }, DEBOUNCE_MS);
  }, [setSearchQuery]);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [setSearchQuery]);

  const handleSelect = useCallback((id) => {
    const store = useSatelliteStore.getState();
    if (store.selectedIds.has(id)) {
      store.deselectSatellite(id);
    } else {
      store.selectSatellite(id);
    }
  }, []);

  const hasResults = searchResults.length > 0;
  const showResults = localQuery.trim().length > 0;
  const useVirtual = searchResults.length > 20;

  const virtualizer = useVirtualizer({
    count: searchResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 5,
    enabled: useVirtual && showResults,
  });

  // cleanup debounce on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className="mb-4">
      {/* input */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-secondary)' }}
        />
        <input
          type="text"
          value={localQuery}
          onChange={handleChange}
          placeholder="Search satellites..."
          className="w-full pl-8 pr-8 py-1.5 rounded-md text-[11px] bg-black/30 border border-white/5 outline-none focus:border-[var(--accent)]/30 transition-colors duration-150"
          style={{ color: 'var(--text-primary)' }}
        />
        {localQuery && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--glass-hover)]"
          >
            <X size={12} style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>

      {/* results */}
      {showResults && (
        <div
          ref={parentRef}
          className="mt-1.5 max-h-64 overflow-y-auto custom-scroll rounded-md bg-black/20 border border-white/5"
        >
          {!hasResults ? (
            <div
              className="px-3 py-4 text-center text-[10px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              No results found
            </div>
          ) : useVirtual ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((vItem) => {
                const sat = searchResults[vItem.index];
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
                      onSelect={handleSelect}
                      isSelected={selectedIds.has(sat.id)}
                      showAltitude
                      altitude={altMap.get(sat.id)}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            searchResults.map((sat) => (
              <SatelliteCard
                key={sat.id}
                satellite={sat}
                onSelect={handleSelect}
                isSelected={selectedIds.has(sat.id)}
                showAltitude
                altitude={altMap.get(sat.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
