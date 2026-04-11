import { useEffect, useRef } from 'react';
import useSatelliteStore from '../stores/satelliteStore';

// parse /sat/:id from URL on mount, resolve after catalog loads
export function copyShareUrl(noradId) {
  const url = `${window.location.origin}/sat/${noradId}`;
  navigator.clipboard.writeText(url);
}

export default function useUrlSync() {
  const pendingIdRef = useRef(null);
  const catalogLoaded = useSatelliteStore((s) => s.catalogLoaded);

  // parse URL on mount
  useEffect(() => {
    const match = window.location.pathname.match(/^\/sat\/(\d+)$/);
    if (match) {
      pendingIdRef.current = parseInt(match[1], 10);
    }
  }, []);

  // resolve pending ID when catalog loads
  useEffect(() => {
    if (!catalogLoaded || pendingIdRef.current == null) return;

    const id = pendingIdRef.current;
    pendingIdRef.current = null;

    const { satellites, setDetailSatelliteId } = useSatelliteStore.getState();
    if (satellites.has(id)) {
      setDetailSatelliteId(id);
    }
  }, [catalogLoaded]);
}
