import { Menu, X, Settings, Orbit, Flame, Radar, ScanLine, Sun } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import useAnalysisStore from '../../stores/analysisStore';

export default function TopBar() {
  const menuOpen = useAppStore((s) => s.menuOpen);
  const toggleMenu = useAppStore((s) => s.toggleMenu);
  const toggleSettings = useAppStore((s) => s.toggleSettings);

  const constellationDashboardOpen = useAnalysisStore((s) => s.constellationDashboardOpen);
  const reentryPanelOpen = useAnalysisStore((s) => s.reentryPanelOpen);
  const closeApproachPanelOpen = useAnalysisStore((s) => s.closeApproachPanelOpen);
  const tleAnalyzerOpen = useAnalysisStore((s) => s.tleAnalyzerOpen);
  const photobombPanelOpen = useAnalysisStore((s) => s.photobombPanelOpen);
  const toggleConstellationDashboard = useAnalysisStore((s) => s.toggleConstellationDashboard);
  const toggleReentryPanel = useAnalysisStore((s) => s.toggleReentryPanel);
  const toggleCloseApproachPanel = useAnalysisStore((s) => s.toggleCloseApproachPanel);
  const toggleTleAnalyzer = useAnalysisStore((s) => s.toggleTleAnalyzer);
  const togglePhotobombPanel = useAnalysisStore((s) => s.togglePhotobombPanel);

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

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--text-secondary)] opacity-30" />

      {/* Analysis tool buttons */}
      <button
        onClick={toggleConstellationDashboard}
        className="p-1.5 rounded-full transition-colors duration-200 hover:bg-[var(--glass-hover)]"
        aria-label="Constellation Dashboard"
        title="Constellation Dashboard"
      >
        <Orbit size={16} style={{ color: constellationDashboardOpen ? 'var(--accent)' : 'var(--text-primary)' }} />
      </button>
      <button
        onClick={toggleReentryPanel}
        className="p-1.5 rounded-full transition-colors duration-200 hover:bg-[var(--glass-hover)]"
        aria-label="Re-entry Predictions"
        title="Re-entry Predictions"
      >
        <Flame size={16} style={{ color: reentryPanelOpen ? 'var(--accent)' : 'var(--text-primary)' }} />
      </button>
      <button
        onClick={toggleCloseApproachPanel}
        className="p-1.5 rounded-full transition-colors duration-200 hover:bg-[var(--glass-hover)]"
        aria-label="Close Approach Analysis"
        title="Close Approach Analysis"
      >
        <Radar size={16} style={{ color: closeApproachPanelOpen ? 'var(--accent)' : 'var(--text-primary)' }} />
      </button>
      <button
        onClick={toggleTleAnalyzer}
        className="p-1.5 rounded-full transition-colors duration-200 hover:bg-[var(--glass-hover)]"
        aria-label="TLE Analyzer"
        title="TLE Analyzer"
      >
        <ScanLine size={16} style={{ color: tleAnalyzerOpen ? 'var(--accent)' : 'var(--text-primary)' }} />
      </button>
      <button
        onClick={togglePhotobombPanel}
        className="p-1.5 rounded-full transition-colors duration-200 hover:bg-[var(--glass-hover)]"
        aria-label="Photobomb Finder"
        title="Photobomb Finder"
      >
        <Sun size={16} style={{ color: photobombPanelOpen ? 'var(--accent)' : 'var(--text-primary)' }} />
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--text-secondary)] opacity-30" />

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
