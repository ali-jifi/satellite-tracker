import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Satellite } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import useAnalysisStore from '../../stores/analysisStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { detectConstellations, computeCoverage, GROWTH_MILESTONES } from '../../utils/constellationDetector';

Chart.register(...registerables);

const ACCENT_COLOR = '#4fc3f7';
const GRID_COLOR = 'rgba(255,255,255,0.05)';
const TEXT_COLOR = '#7a8599';

function StatusBadge({ count, color, label }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] tabular-nums font-medium"
      style={{ background: `${color}15`, color }}
      title={label}
    >
      {count}
    </span>
  );
}

function GrowthChart({ constellationName, currentCount }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const milestones = GROWTH_MILESTONES[constellationName] || [];
    const data = [...milestones.map((m) => ({ x: m.date, y: m.count }))];

    // append current live count as latest point
    const today = new Date().toISOString().split('T')[0];
    if (currentCount != null) {
      data.push({ x: today, y: currentCount });
    }

    if (data.length === 0) return;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        datasets: [
          {
            label: constellationName,
            data,
            borderColor: ACCENT_COLOR,
            backgroundColor: `${ACCENT_COLOR}20`,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: ACCENT_COLOR,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#ccc',
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'month', tooltipFormat: 'MMM yyyy' },
            grid: { color: GRID_COLOR },
            ticks: { color: TEXT_COLOR, font: { size: 9 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: GRID_COLOR },
            ticks: { color: TEXT_COLOR, font: { size: 9 } },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [constellationName, currentCount]);

  return (
    <div style={{ height: 160 }} className="mt-2">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function ConstellationDashboard() {
  const isOpen = useAnalysisStore((s) => s.constellationDashboardOpen);
  const setConstellationData = useAnalysisStore((s) => s.setConstellationData);
  const highlightedConstellation = useAnalysisStore((s) => s.highlightedConstellation);
  const setHighlighted = useAnalysisStore((s) => s.setHighlightedConstellation);
  const closeAll = useAnalysisStore((s) => s.closeAllAnalysisPanels);

  const [constellations, setConstellations] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [coverageMap, setCoverageMap] = useState({});
  const [coverageComputing, setCoverageComputing] = useState(new Set());

  // detect constellations when panel opens
  useEffect(() => {
    if (!isOpen) {
      // clear highlighting when panel closes
      setHighlighted(null);
      setConstellationData(null);
      return;
    }

    const { satelliteArray } = useSatelliteStore.getState();
    if (satelliteArray.length === 0) return;

    const detected = detectConstellations(satelliteArray);
    setConstellations(detected);
    setConstellationData(detected);
    setSelectedName(null);
    setCoverageMap({});
  }, [isOpen, setConstellationData, setHighlighted]);

  // compute coverage lazily per constellation
  const requestCoverage = useCallback(
    (name, satellites) => {
      if (coverageMap[name] != null || coverageComputing.has(name)) return;
      setCoverageComputing((prev) => new Set(prev).add(name));

      // async to avoid blocking UI
      setTimeout(() => {
        const pct = computeCoverage(satellites);
        setCoverageMap((prev) => ({ ...prev, [name]: pct }));
        setCoverageComputing((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }, 0);
    },
    [coverageMap, coverageComputing]
  );

  const handleSelect = useCallback(
    (name) => {
      const next = selectedName === name ? null : name;
      setSelectedName(next);
      setHighlighted(next);
    },
    [selectedName, setHighlighted]
  );

  if (!isOpen) return null;

  // summary stats
  const totalConstellations = constellations.length;
  const totalSatellites = constellations.reduce((s, c) => s + c.stats.total, 0);
  const totalActive = constellations.reduce((s, c) => s + c.stats.active, 0);

  const selectedConstellation = constellations.find((c) => c.name === selectedName);

  return (
    <div
      className="glass fixed z-30 overflow-y-auto"
      style={{
        top: 64,
        right: 16,
        width: 400,
        maxHeight: '75vh',
        borderRadius: 8,
      }}
    >
      <div className="px-3 py-2.5">
        {/* header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Satellite size={14} style={{ color: 'var(--accent)' }} />
            <span
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: 'var(--text-primary)' }}
            >
              Constellations
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

        {/* summary stats */}
        <div
          className="flex gap-4 mb-3 pb-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {totalConstellations}
            </div>
            <div className="text-[9px] uppercase" style={{ color: 'var(--text-secondary)' }}>
              Detected
            </div>
          </div>
          <div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {totalSatellites.toLocaleString()}
            </div>
            <div className="text-[9px] uppercase" style={{ color: 'var(--text-secondary)' }}>
              Satellites
            </div>
          </div>
          <div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: '#4ade80' }}
            >
              {totalActive.toLocaleString()}
            </div>
            <div className="text-[9px] uppercase" style={{ color: 'var(--text-secondary)' }}>
              Active
            </div>
          </div>
        </div>

        {/* constellation list */}
        <div className="space-y-[2px]">
          {constellations.map((c) => {
            const isSelected = selectedName === c.name;
            const coverage = coverageMap[c.name];
            const computing = coverageComputing.has(c.name);

            // request coverage computation when visible
            if (coverage == null && !computing) {
              requestCoverage(c.name, c.satellites);
            }

            return (
              <button
                key={c.name}
                onClick={() => handleSelect(c.name)}
                className="w-full text-left px-2 py-1.5 rounded transition-colors"
                style={{
                  background: isSelected ? 'rgba(79, 195, 247, 0.1)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {c.name}
                  </span>
                  <span
                    className="text-[10px] tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {c.stats.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusBadge count={c.stats.active} color="#4ade80" label="Active" />
                  {c.stats.deorbiting > 0 && (
                    <StatusBadge count={c.stats.deorbiting} color="#facc15" label="Deorbiting" />
                  )}
                  {c.stats.decayed > 0 && (
                    <StatusBadge count={c.stats.decayed} color="#f87171" label="Decayed" />
                  )}
                  <span
                    className="text-[9px] tabular-nums ml-auto"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {coverage != null
                      ? `${coverage.toFixed(1)}% coverage`
                      : computing
                        ? '...'
                        : '...'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* growth chart for selected constellation */}
        {selectedConstellation && (
          <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div
              className="text-[9px] tracking-[0.15em] uppercase mb-1"
              style={{ color: 'var(--accent)', fontWeight: 600 }}
            >
              Growth - {selectedConstellation.name}
            </div>
            <GrowthChart
              constellationName={selectedConstellation.name}
              currentCount={selectedConstellation.stats.total}
            />
          </div>
        )}

        {constellations.length === 0 && (
          <div
            className="text-[11px] py-4 text-center"
            style={{ color: 'var(--text-secondary)' }}
          >
            Loading satellite catalog...
          </div>
        )}
      </div>
    </div>
  );
}
