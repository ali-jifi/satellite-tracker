import * as Cesium from 'cesium';
import useSatelliteStore from '../stores/satelliteStore.js';
import useAppStore from '../stores/appStore.js';

const PROPAGATION_INTERVAL_MS = 1000;

let worker = null;
let intervalId = null;

/**
 * Start satellite propagation in a Web Worker.
 * Reads the satellite catalog from the store, initializes the worker with TLE data,
 * and begins a 1-second propagation loop.
 */
export function startPropagation() {
  if (worker) {
    console.warn('[PropagationService] Already running. Call stopPropagation() first.');
    return;
  }

  const { satellites } = useSatelliteStore.getState();

  if (satellites.size === 0) {
    console.warn('[PropagationService] No satellites in catalog. Skipping start.');
    return;
  }

  // Build TLE payload from catalog
  const satPayload = [];
  for (const sat of satellites.values()) {
    if (sat.tle1 && sat.tle2) {
      satPayload.push({ id: sat.id, tle1: sat.tle1, tle2: sat.tle2 });
    }
  }

  // Create worker
  worker = new Worker(
    new URL('../workers/propagationWorker.js', import.meta.url),
    { type: 'module' }
  );

  // Handle messages from worker
  worker.onmessage = (e) => {
    const { type } = e.data;

    switch (type) {
      case 'ready':
        console.log(`[PropagationService] Worker ready with ${e.data.count} satellites`);
        startLoop();
        break;

      case 'positions': {
        const buffer = new Float64Array(e.data.buffer);
        useSatelliteStore.getState().setPositionBuffer(buffer, e.data.count);
        break;
      }

      case 'updated':
        console.log(`[PropagationService] Worker updated ${e.data.count} satellites`);
        break;
    }
  };

  worker.onerror = (err) => {
    console.error('[PropagationService] Worker error:', err);
  };

  // Send init message with TLE data
  worker.postMessage({ type: 'init', satellites: satPayload });
}

/**
 * Start the propagation interval loop.
 */
function startLoop() {
  if (intervalId) return;

  // Propagate immediately, then on interval
  sendPropagate();
  intervalId = setInterval(sendPropagate, PROPAGATION_INTERVAL_MS);
}

/**
 * Send a propagate message to the worker.
 */
function sendPropagate() {
  if (worker) {
    const viewer = useAppStore.getState().viewerRef;
    const clockTime = viewer
      ? Cesium.JulianDate.toDate(viewer.clock.currentTime).getTime()
      : Date.now();
    worker.postMessage({ type: 'propagate', timestamp: clockTime });
  }
}

/**
 * Stop propagation and terminate the worker.
 */
export function stopPropagation() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (worker) {
    worker.terminate();
    worker = null;
  }
}

/**
 * Refresh worker TLE data after a background re-fetch.
 * Sends updated TLEs for all satellites currently in the catalog.
 */
export function refreshWorkerData() {
  if (!worker) {
    console.warn('[PropagationService] No active worker. Call startPropagation() first.');
    return;
  }

  const { satellites } = useSatelliteStore.getState();
  const satPayload = [];

  for (const sat of satellites.values()) {
    if (sat.tle1 && sat.tle2) {
      satPayload.push({ id: sat.id, tle1: sat.tle1, tle2: sat.tle2 });
    }
  }

  worker.postMessage({ type: 'update', satellites: satPayload });
}
