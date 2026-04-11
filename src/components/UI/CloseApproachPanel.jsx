import { useState, useRef, useCallback } from 'react';
import useAnalysisStore from '../../stores/analysisStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { preFilterCandidates, findCloseApproaches } from '../../utils/closeApproachDetector';
import useAppStore from '../../stores/appStore';

const SCAN_DURATIONS = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
];

function formatDistance(km) {
  if (km < 10) return `${km.toFixed(2)} km`;
  return `${km.toFixed(1)} km`;
}

function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatVelocity(kmS) {
  if (kmS == null) return '--';
  return `${kmS.toFixed(2)} km/s`;
}

export default function CloseApproachPanel() {
  const open = useAnalysisStore((s) => s.closeApproachPanelOpen);
  const computing = useAnalysisStore((s) => s.closeApproachComputing);
  const results = useAnalysisStore((s) => s.closeApproachResults);
  const progress = useAnalysisStore((s) => s.closeApproachProgress);
  const detailSatelliteId = useSatelliteStore((s) => s.detailSatelliteId);
  const satellites = useSatelliteStore((s) => s.satellites);

  const [thresholdKm, setThresholdKm] = useState(50);
  const [scanDuration, setScanDuration] = useState(24);
  const workerRef = useRef(null);

  const handleScan = useCallback(() => {
    if (!detailSatelliteId) return;

    const refSat = satellites.get(detailSatelliteId);
    if (!refSat || !refSat.satrec) return;

    const store = useAnalysisStore.getState();
    store.setCloseApproachComputing(true);
    store.setCloseApproachProgress(0);
    store.clearCloseApproachVisualization();

    // get current sim time from CesiumJS clock
    const appState = useAppStore.getState();
    const viewerRef = appState.viewerRef;
    let startTime = Date.now();
    if (viewerRef?.clock) {
      try {
        startTime = window.Cesium.JulianDate.toDate(viewerRef.clock.currentTime).getTime();
      } catch {
        // fallback to Date.now
      }
    }

    // pre-filter on main thread (fast)
    const candidates = preFilterCandidates(refSat, satellites, thresholdKm);

    if (candidates.length < 500) {
      // run on main thread for small sets, setTimeout to avoid blocking UI
      setTimeout(() => {
        const approachResults = findCloseApproaches(refSat.satrec, candidates, {
          thresholdKm,
          scanHours: scanDuration,
          startTime,
          onProgress: (pct) => {
            useAnalysisStore.getState().setCloseApproachProgress(pct);
          },
        });
        useAnalysisStore.getState().setCloseApproachResults(approachResults);
      }, 0);
    } else {
      // offload to web worker for large candidate sets
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const worker = new Worker(
        new URL('../../workers/analysisWorker.js', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const { type: msgType } = e.data;
        if (msgType === 'progress') {
          useAnalysisStore.getState().setCloseApproachProgress(e.data.percent);
        } else if (msgType === 'closeApproachResults') {
          useAnalysisStore.getState().setCloseApproachResults(e.data.results);
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = () => {
        useAnalysisStore.getState().setCloseApproachComputing(false);
        worker.terminate();
        workerRef.current = null;
      };

      // send TLE strings to worker
      const candidateTles = candidates
        .filter((c) => c.tle1 && c.tle2)
        .map((c) => ({ id: c.id, name: c.name, line1: c.tle1, line2: c.tle2 }));

      worker.postMessage({
        type: 'findCloseApproaches',
        referenceTle: { line1: refSat.tle1, line2: refSat.tle2, id: refSat.id, name: refSat.name },
        candidateTles,
        options: { thresholdKm, scanHours: scanDuration, startTime },
      });
    }
  }, [detailSatelliteId, satellites, thresholdKm, scanDuration]);

  const handleResultClick = useCallback(
    (result) => {
      const refSat = satellites.get(detailSatelliteId);
      if (!refSat) return;

      // select approach sat for detail
      useSatelliteStore.getState().setDetailSatelliteId(result.satelliteId);

      // set viz data
      useAnalysisStore.getState().setCloseApproachVisualization({
        referenceSatId: detailSatelliteId,
        approachSatId: result.satelliteId,
        approachTime: result.time,
        distanceKm: result.distanceKm,
        refPositionEci: result.refPositionEci,
        candPositionEci: result.candPositionEci,
      });
    },
    [detailSatelliteId, satellites]
  );

  if (!open) return null;

  const refSat = detailSatelliteId ? satellites.get(detailSatelliteId) : null;

  return (
    <div
      className="fixed z-30 flex flex-col"
      style={{
        top: 64,
        right: 16,
        width: 380,
        maxHeight: '75vh',
        background: 'rgba(12, 12, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
      }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--accent)' }}>
          Close Approaches
        </span>
        <button
          className="text-xs opacity-50 hover:opacity-100"
          onClick={() => useAnalysisStore.getState().toggleCloseApproachPanel()}
        >
          ESC
        </button>
      </div>

      {!refSat ? (
        <div className="px-3 py-6 text-center text-xs opacity-50">
          Select a satellite to detect close approaches
        </div>
      ) : (
        <>
          {/* ref sat */}
          <div className="px-3 py-2 text-xs opacity-70">
            Reference: <span style={{ color: 'var(--accent)' }}>{refSat.name}</span> ({refSat.id})
          </div>

          {/* controls */}
          <div className="px-3 py-2 flex flex-col gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {/* threshold slider */}
            <div className="flex items-center gap-2">
              <label className="text-xs opacity-70 w-20 shrink-0">Threshold</label>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={thresholdKm}
                onChange={(e) => setThresholdKm(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-xs w-14 text-right">{thresholdKm} km</span>
            </div>

            {/* scan duration */}
            <div className="flex items-center gap-2">
              <label className="text-xs opacity-70 w-20 shrink-0">Duration</label>
              <div className="flex gap-1">
                {SCAN_DURATIONS.map((d) => (
                  <button
                    key={d.hours}
                    className="px-2 py-0.5 text-xs rounded"
                    style={{
                      background: scanDuration === d.hours ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: scanDuration === d.hours ? '#000' : 'var(--text-primary)',
                    }}
                    onClick={() => setScanDuration(d.hours)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* scan btn */}
            <button
              className="w-full py-1.5 text-xs font-semibold rounded"
              style={{
                background: computing ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
                color: computing ? 'var(--text-primary)' : '#000',
                opacity: computing ? 0.5 : 1,
                cursor: computing ? 'not-allowed' : 'pointer',
              }}
              onClick={handleScan}
              disabled={computing}
            >
              {computing ? 'Scanning...' : 'Scan for Close Approaches'}
            </button>

            {/* progress bar */}
            {computing && (
              <div className="w-full h-1 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            )}
          </div>

          {/* results */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            {results.length === 0 && !computing && (
              <div className="px-3 py-4 text-center text-xs opacity-40">
                No results yet. Click Scan to detect close approaches.
              </div>
            )}
            {results.map((r) => (
              <button
                key={r.satelliteId}
                className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onClick={() => handleResultClick(r)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold truncate" style={{ maxWidth: 200 }}>
                    {r.name}
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: r.distanceKm < 10 ? '#ef4444' : 'var(--accent)' }}
                  >
                    {formatDistance(r.distanceKm)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs opacity-50">{formatTime(r.time)}</span>
                  <span className="text-xs opacity-60">{formatVelocity(r.relativeVelocityKmS)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
