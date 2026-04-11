import { useState, useEffect } from 'react';
import { X, ScanLine } from 'lucide-react';
import useAnalysisStore from '../../stores/analysisStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { analyzeTle } from '../../utils/tleAnalyzer';

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

function epochHealthColor(health) {
  if (health === 'fresh') return '#22c55e';
  if (health === 'aging') return '#eab308';
  return '#ef4444';
}

function formatEpochDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function TleAnalyzerPanel() {
  const open = useAnalysisStore((s) => s.tleAnalyzerOpen);
  const closeAll = useAnalysisStore((s) => s.closeAllAnalysisPanels);
  const detailSatelliteId = useSatelliteStore((s) => s.detailSatelliteId);
  const satellites = useSatelliteStore((s) => s.satellites);

  const [analysis, setAnalysis] = useState(null);

  const sat =
    detailSatelliteId != null ? satellites.get(detailSatelliteId) : null;

  useEffect(() => {
    if (!open || !sat) {
      setAnalysis(null);
      return;
    }
    const result = analyzeTle(sat);
    setAnalysis(result);
  }, [open, sat]);

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
          <ScanLine size={14} style={{ color: 'var(--accent)' }} />
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: 'var(--text-primary)' }}
          >
            TLE Analyzer
          </span>
          {sat && (
            <span
              className="text-[9px] tabular-nums"
              style={{ color: 'var(--text-secondary)' }}
            >
              - {sat.name}
            </span>
          )}
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
        {!sat ? (
          <div
            className="text-[11px] text-center py-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            Select a satellite to analyze its TLE
          </div>
        ) : !analysis ? (
          <div
            className="text-[11px] text-center py-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            No TLE data available for this satellite
          </div>
        ) : (
          <>
            {/* elements */}
            <SectionLabel>Elements</SectionLabel>
            <DataRow
              label="Semi-Major Axis"
              value={`${analysis.semiMajorAxisKm.toFixed(2)} km`}
            />
            <DataRow
              label="Eccentricity"
              value={analysis.eccentricity.toFixed(6)}
            />
            <DataRow
              label="Inclination"
              value={`${analysis.inclinationDeg.toFixed(4)}\u00B0`}
            />
            <DataRow
              label="RAAN"
              value={`${analysis.raanDeg.toFixed(4)}\u00B0`}
            />
            <DataRow
              label="Arg. of Perigee"
              value={`${analysis.argPerigeeDeg.toFixed(4)}\u00B0`}
            />
            <DataRow
              label="Mean Anomaly"
              value={`${analysis.meanAnomalyDeg.toFixed(4)}\u00B0`}
            />
            <DataRow
              label="Mean Motion"
              value={`${analysis.meanMotionRevDay.toFixed(4)} rev/day`}
            />

            {/* health */}
            <SectionLabel>Health</SectionLabel>
            <div className="flex justify-between py-[1px]">
              <span
                className="text-[10px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                Epoch
              </span>
              <span className="text-[10px] tabular-nums flex items-center gap-1.5">
                <span style={{ color: 'var(--text-primary)' }}>
                  {formatEpochDate(analysis.epochDate)}
                </span>
                <span style={{ color: epochHealthColor(analysis.epochHealth) }}>
                  ({analysis.epochAgeDays.toFixed(1)}d ago)
                </span>
              </span>
            </div>
            <DataRow label="B* Drag" value={analysis.bstar.toExponential(4)} />
            <DataRow label="ndot" value={analysis.ndot.toExponential(4)} />
            <DataRow label="nddot" value={analysis.nddot.toExponential(4)} />

            {/* derived */}
            <SectionLabel>Derived</SectionLabel>
            <DataRow
              label="Period"
              value={`${analysis.periodMinutes.toFixed(2)} min`}
            />
            <DataRow
              label="Apogee"
              value={`${analysis.apogeeKm.toFixed(1)} km`}
            />
            <DataRow
              label="Perigee"
              value={`${analysis.perigeeKm.toFixed(1)} km`}
            />
            <div className="flex justify-between py-[1px]">
              <span
                className="text-[10px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                Est. Lifetime
              </span>
              {analysis.estimatedLifetime ? (
                <span className="text-[10px] tabular-nums flex items-center gap-1.5">
                  <span style={{ color: 'var(--text-primary)' }}>
                    ~{Math.round(analysis.estimatedLifetime.days)}d remaining
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background:
                        analysis.estimatedLifetime.confidence === 'HIGH'
                          ? '#22c55e'
                          : analysis.estimatedLifetime.confidence === 'MEDIUM'
                            ? '#eab308'
                            : '#ef4444',
                    }}
                    title={`${analysis.estimatedLifetime.confidence} confidence`}
                  />
                </span>
              ) : (
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  N/A
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
