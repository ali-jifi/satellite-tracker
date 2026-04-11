import { useEffect } from 'react';
import { X, Flame } from 'lucide-react';
import useAnalysisStore from '../../stores/analysisStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { scanAllReentries } from '../../utils/reentryPredictor';

function confidenceColor(confidence) {
  if (confidence === 'HIGH') return '#22c55e';
  if (confidence === 'MEDIUM') return '#eab308';
  return '#ef4444';
}

function epochAgeColor(days) {
  if (days < 3) return '#22c55e';
  if (days < 7) return '#eab308';
  return '#ef4444';
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ReentryPanel() {
  const open = useAnalysisStore((s) => s.reentryPanelOpen);
  const results = useAnalysisStore((s) => s.reentryResults);
  const computing = useAnalysisStore((s) => s.reentryComputing);
  const setResults = useAnalysisStore((s) => s.setReentryResults);
  const setComputing = useAnalysisStore((s) => s.setReentryComputing);
  const closeAll = useAnalysisStore((s) => s.closeAllAnalysisPanels);
  const satelliteArray = useSatelliteStore((s) => s.satelliteArray);
  const setDetailSatelliteId = useSatelliteStore((s) => s.setDetailSatelliteId);

  useEffect(() => {
    if (!open) return;
    if (satelliteArray.length === 0) return;

    setComputing(true);

    // rAF to avoid blocking UI
    const id = requestAnimationFrame(() => {
      const predictions = scanAllReentries(satelliteArray);
      setResults(predictions);
    });

    return () => cancelAnimationFrame(id);
  }, [open, satelliteArray, setComputing, setResults]);

  if (!open) return null;

  return (
    <div
      className="glass fixed z-30 flex flex-col"
      style={{
        top: 64,
        right: 16,
        width: 380,
        maxHeight: '75vh',
        borderRadius: 8,
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Flame size={14} style={{ color: 'var(--accent)' }} />
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: 'var(--text-primary)' }}
          >
            Re-entry Predictor
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

      {/* content */}
      <div className="overflow-y-auto px-3 pb-2.5 flex-1 min-h-0">
        {computing && results.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="w-5 h-5 border-2 border-transparent rounded-full animate-spin"
              style={{
                borderTopColor: 'var(--accent)',
                borderRightColor: 'var(--accent)',
              }}
            />
          </div>
        ) : results.length === 0 ? (
          <div
            className="text-[11px] text-center py-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            No satellites with predicted re-entry found
          </div>
        ) : (
          <div className="space-y-1">
            {results.map((entry) => (
              <button
                key={entry.satelliteId}
                className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--glass-hover)] transition-colors"
                onClick={() => setDetailSatelliteId(entry.satelliteId)}
              >
                {/* name row */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className="text-[11px] font-semibold truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {entry.name}
                  </span>
                  <span
                    className="text-[9px] tabular-nums flex-shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    #{entry.satelliteId}
                  </span>
                </div>

                {/* prediction row */}
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px] tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatDate(entry.predictedDate)}
                  </span>
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    +/- {entry.uncertaintyDays.toFixed(0)}d
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: confidenceColor(entry.confidence) }}
                    title={`${entry.confidence} confidence`}
                  />
                </div>

                {/* details row */}
                <div className="flex items-center gap-3">
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Perigee {entry.perigeeKm.toFixed(0)} km
                  </span>
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: epochAgeColor(entry.epochAge) }}
                  >
                    Epoch {entry.epochAge.toFixed(1)}d ago
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
