import { Menu, X, Settings } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';

export default function TopBar() {
  const menuOpen = useAppStore((s) => s.menuOpen);
  const toggleMenu = useAppStore((s) => s.toggleMenu);
  const toggleSettings = useAppStore((s) => s.toggleSettings);

  const totalCount = useSatelliteStore((s) => s.satelliteArray.length);
  const activeFilter = useSatelliteStore((s) => s.activeFilter);
  const categoryIndex = useSatelliteStore((s) => s.categoryIndex);
  const countryIndex = useSatelliteStore((s) => s.countryIndex);

  // Calculate filtered count when a filter is active
  let displayCount = null;
  if (totalCount > 0) {
    if (activeFilter) {
      let filteredCount = 0;
      if (activeFilter.type === 'category') {
        const ids = categoryIndex.get(activeFilter.value);
        filteredCount = ids ? ids.size : 0;
      } else if (activeFilter.type === 'country') {
        const ids = countryIndex.get(activeFilter.value);
        filteredCount = ids ? ids.size : 0;
      }
      displayCount = `${filteredCount.toLocaleString()} / ${totalCount.toLocaleString()}`;
    } else {
      displayCount = totalCount.toLocaleString();
    }
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 glass rounded-full px-2 py-1.5 flex items-center gap-4">
      {/* Hamburger / Close */}
      <button
        onClick={toggleMenu}
        className="p-1.5 rounded-full transition-colors duration-200 hover:bg-[var(--glass-hover)]"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? (
          <X size={18} style={{ color: 'var(--accent)' }} />
        ) : (
          <Menu size={18} style={{ color: 'var(--text-primary)' }} />
        )}
      </button>

      {/* Title */}
      <span
        className="text-xs tracking-[0.25em] uppercase select-none"
        style={{ color: 'var(--accent)', fontWeight: 500 }}
      >
        SATTRACKER
      </span>

      {/* Satellite count */}
      {displayCount && (
        <span
          className="text-[9px] tabular-nums select-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          {displayCount}
        </span>
      )}

      {/* Settings gear */}
      <button
        onClick={toggleSettings}
        className="p-1.5 rounded-full transition-colors duration-200 hover:bg-[var(--glass-hover)]"
        aria-label="Settings"
      >
        <Settings size={18} style={{ color: 'var(--text-primary)' }} />
      </button>
    </div>
  );
}
