import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sun, Moon } from 'lucide-react';
import useAnalysisStore from '../../stores/analysisStore';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import {
  predictTransitsWarningMode,
  predictTransitsPlanningMode,
} from '../../utils/transitPredictor';

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateTime(date) {
  return (
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    formatTime(date)
  );
}

function formatRelativeTime(date) {
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return 'now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `in ${hrs}h ${remMins}m`;
}

function formatAngularDistance(arcsec) {
  if (arcsec > 3600) {
    return `${(arcsec / 3600).toFixed(1)}\u00B0`;
  }
  return `${arcsec.toFixed(1)}"`;
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div
        className="w-5 h-5 border-2 border-transparent rounded-full animate-spin"
        style={{
          borderTopColor: 'var(--accent)',
          borderRightColor: 'var(--accent)',
        }}
      />
    </div>
  );
}

function TransitEntry({ entry, showDate }) {
  const isImminent = entry.time.getTime() - Date.now() < 15 * 60 * 1000;

  return (
    <div
      className="px-2.5 py-2 rounded-md transition-colors"
      style={
        isImminent
          ? {
              background: 'rgba(var(--accent-rgb, 59, 130, 246), 0.1)',
              boxShadow: '0 0 8px rgba(var(--accent-rgb, 59, 130, 246), 0.2)',
            }
          : undefined
      }
    >
      {/* Top row: body icon + name + relative time */}
      <div className="flex items-center gap-2 mb-0.5">
        {entry.targetBody === 'sun' ? (
          <Sun size={12} style={{ color: '#facc15', flexShrink: 0 }} />
        ) : (
          <Moon size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
        )}
        <span
          className="text-[11px] font-semibold truncate flex-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {entry.name}
        </span>
        <span
          className="text-[9px] tabular-nums flex-shrink-0"
          style={{ color: isImminent ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          {formatRelativeTime(entry.time)}
        </span>
      </div>

      {/* Data row */}
      <div className="flex items-center gap-3 pl-5">
        <span
          className="text-[10px] tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {showDate ? formatDateTime(entry.time) : formatTime(entry.time)}
        </span>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: 'var(--text-secondary)' }}
        >
          {formatAngularDistance(entry.angularDistanceArcsec)}
        </span>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: 'var(--text-secondary)' }}
        >
          {formatDuration(entry.durationMs)}
        </span>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: 'var(--text-secondary)' }}
        >
          mag {entry.brightness.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function WarningMode() {
  const [results, setResults] = useState([]);
  const [computing, setComputing] = useState(false);
  const observer = useAppStore((s) => s.observerLocation);
  const bookmarks = useAppStore((s) => s.bookmarks);
  const satellites = useSatelliteStore((s) => s.satellites);
  const setTransitResults = useAnalysisStore((s) => s.setTransitResults);
  const intervalRef = useRef(null);

  const runScan = useCallback(() => {
    if (!observer) return;

    // Build satellite list: bookmarked satellites
    const satList = [];
    const seen = new Set();

    for (const id of bookmarks) {
      const sat = satellites.get(id);
      if (sat && sat.satrec && !seen.has(id)) {
        satList.push(sat);
        seen.add(id);
      }
    }

    // Also add bright satellites (those with low NORAD IDs tend to be bigger/brighter,
    // but we take a sample from the catalog for a reasonable scan set)
    // Limit to first 200 non-bookmarked satellites to keep computation fast
    let addCount = 0;
    for (const [id, sat] of satellites) {
      if (addCount >= 200) break;
      if (!seen.has(id) && sat.satrec) {
        satList.push(sat);
        seen.add(id);
        addCount++;
      }
    }

    if (satList.length === 0) {
      setResults([]);
      return;
    }

    setComputing(true);
    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      try {
        const transits = predictTransitsWarningMode(satList, observer);
        setResults(transits);
        setTransitResults(transits);
      } catch {
        setResults([]);
      }
      setComputing(false);
    });
  }, [observer, bookmarks, satellites, setTransitResults]);

  useEffect(() => {
    runScan();
    intervalRef.current = setInterval(runScan, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runScan]);

  if (computing && results.length === 0) return <Spinner />;

  if (results.length === 0) {
    return (
      <div
        className="text-[11px] text-center py-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        No transits predicted in the next 2 hours
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {results.map((entry, i) => (
        <TransitEntry key={`${entry.satelliteId}-${i}`} entry={entry} showDate={false} />
      ))}
    </div>
  );
}

function PlanningMode() {
  const observer = useAppStore((s) => s.observerLocation);
  const satellites = useSatelliteStore((s) => s.satelliteArray);
  const setTransitResults = useAnalysisStore((s) => s.setTransitResults);

  const now = new Date();
  const sixHoursLater = new Date(now.getTime() + 6 * 3600000);

  const [targetBody, setTargetBody] = useState('sun');
  const [startDate, setStartDate] = useState(toDatetimeLocal(now));
  const [endDate, setEndDate] = useState(toDatetimeLocal(sixHoursLater));
  const [minDuration, setMinDuration] = useState(0);
  const [threshold, setThreshold] = useState(2.0);
  const [results, setResults] = useState(null);
  const [computing, setComputing] = useState(false);

  const handleSearch = useCallback(() => {
    if (!observer) return;

    const satsWithSatrec = satellites.filter((s) => s.satrec);
    if (satsWithSatrec.length === 0) return;

    setComputing(true);
    requestAnimationFrame(() => {
      try {
        const transits = predictTransitsPlanningMode(satsWithSatrec, observer, {
          targetBody,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          minDurationMs: minDuration * 1000,
          angularThresholdDeg: threshold,
        });
        setResults(transits);
        setTransitResults(transits);
      } catch {
        setResults([]);
      }
      setComputing(false);
    });
  }, [observer, satellites, targetBody, startDate, endDate, minDuration, threshold, setTransitResults]);

  return (
    <div className="space-y-2.5">
      {/* Target body toggle */}
      <div>
        <label
          className="text-[9px] uppercase tracking-wider block mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Target Body
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => setTargetBody('sun')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] transition-colors"
            style={{
              background: targetBody === 'sun' ? 'var(--accent)' : 'var(--glass-bg)',
              color: targetBody === 'sun' ? '#000' : 'var(--text-primary)',
            }}
          >
            <Sun size={12} />
            Sun
          </button>
          <button
            onClick={() => setTargetBody('moon')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] transition-colors"
            style={{
              background: targetBody === 'moon' ? 'var(--accent)' : 'var(--glass-bg)',
              color: targetBody === 'moon' ? '#000' : 'var(--text-primary)',
            }}
          >
            <Moon size={12} />
            Moon
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            className="text-[9px] uppercase tracking-wider block mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Start
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-2 py-1 rounded text-[10px] bg-black/30 border border-white/10 outline-none focus:border-[var(--accent)]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label
            className="text-[9px] uppercase tracking-wider block mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            End
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-2 py-1 rounded text-[10px] bg-black/30 border border-white/10 outline-none focus:border-[var(--accent)]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            className="text-[9px] uppercase tracking-wider block mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Min Duration (s)
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={minDuration}
            onChange={(e) => setMinDuration(Number(e.target.value))}
            className="w-full px-2 py-1 rounded text-[10px] bg-black/30 border border-white/10 outline-none focus:border-[var(--accent)]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label
            className="text-[9px] uppercase tracking-wider block mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Threshold (deg)
          </label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full px-2 py-1 rounded text-[10px] bg-black/30 border border-white/10 outline-none focus:border-[var(--accent)]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Search button */}
      <button
        onClick={handleSearch}
        disabled={computing}
        className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors"
        style={{
          background: computing ? 'var(--glass-bg)' : 'var(--accent)',
          color: computing ? 'var(--text-secondary)' : '#000',
        }}
      >
        {computing ? 'Searching...' : 'Search'}
      </button>

      {/* Results */}
      {computing && <Spinner />}
      {results !== null && !computing && (
        results.length === 0 ? (
          <div
            className="text-[11px] text-center py-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            No transits found in the specified window
          </div>
        ) : (
          <div className="space-y-0.5">
            <div
              className="text-[9px] uppercase tracking-wider px-2.5 pb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {results.length} transit{results.length !== 1 ? 's' : ''} found
            </div>
            {results.map((entry, i) => (
              <TransitEntry key={`${entry.satelliteId}-${i}`} entry={entry} showDate={true} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function PhotobombPanel() {
  const open = useAnalysisStore((s) => s.photobombPanelOpen);
  const closeAll = useAnalysisStore((s) => s.closeAllAnalysisPanels);
  const observer = useAppStore((s) => s.observerLocation);
  const [activeTab, setActiveTab] = useState('warning');

  if (!open) return null;

  return (
    <div
      className="glass fixed z-30 flex flex-col"
      style={{
        top: 64,
        right: 16,
        width: 400,
        maxHeight: '75vh',
        borderRadius: 8,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sun size={14} style={{ color: 'var(--accent)' }} />
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: 'var(--text-primary)' }}
          >
            Photobomb Finder
          </span>
        </div>
        <button
          onClick={closeAll}
          className="p-0.5 rounded hover:bg-[var(--glass-hover)]"
          title="Close"
        >
          <X size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex px-3 gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('warning')}
          className="px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors"
          style={{
            color: activeTab === 'warning' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'warning' ? '2px solid var(--accent)' : '2px solid transparent',
          }}
        >
          Warning
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className="px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors"
          style={{
            color: activeTab === 'planning' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'planning' ? '2px solid var(--accent)' : '2px solid transparent',
          }}
        >
          Planning
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto px-3 pb-2.5 flex-1 min-h-0 mt-1">
        {!observer ? (
          <div
            className="text-[11px] text-center py-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            Set your observer location first
          </div>
        ) : activeTab === 'warning' ? (
          <WarningMode />
        ) : (
          <PlanningMode />
        )}
      </div>
    </div>
  );
}
