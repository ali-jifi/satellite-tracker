import { useCallback } from 'react';
import useAppStore from '../stores/appStore';
import useSatelliteStore from '../stores/satelliteStore';

/**
 * Helper hook wrapping bookmark actions.
 * Provides next/prev cycling and toggle with stale-ID filtering.
 */
export default function useBookmarks() {
  const bookmarks = useAppStore((s) => s.bookmarks);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const setBookmarks = useAppStore((s) => s.setBookmarks);

  /**
   * Get valid bookmarks filtered against current satellite catalog.
   */
  const getValidBookmarks = useCallback(() => {
    const satellites = useSatelliteStore.getState().satellites;
    return bookmarks.filter((id) => satellites.has(id));
  }, [bookmarks]);

  /**
   * Select next bookmarked satellite.
   */
  const nextBookmark = useCallback(() => {
    const valid = getValidBookmarks();
    if (valid.length === 0) return;

    const currentId = useSatelliteStore.getState().detailSatelliteId;
    const idx = currentId != null ? valid.indexOf(currentId) : -1;
    const next = (idx + 1) % valid.length;
    useSatelliteStore.getState().setDetailSatelliteId(valid[next]);
  }, [getValidBookmarks]);

  /**
   * Select previous bookmarked satellite.
   */
  const prevBookmark = useCallback(() => {
    const valid = getValidBookmarks();
    if (valid.length === 0) return;

    const currentId = useSatelliteStore.getState().detailSatelliteId;
    const idx = currentId != null ? valid.indexOf(currentId) : -1;
    const prev = idx <= 0 ? valid.length - 1 : idx - 1;
    useSatelliteStore.getState().setDetailSatelliteId(valid[prev]);
  }, [getValidBookmarks]);

  /**
   * Remove stale bookmark IDs not present in the satellite catalog.
   */
  const cleanStaleBookmarks = useCallback(() => {
    const valid = getValidBookmarks();
    if (valid.length !== bookmarks.length) {
      setBookmarks(valid);
    }
  }, [bookmarks, getValidBookmarks, setBookmarks]);

  return {
    bookmarks,
    toggleBookmark,
    nextBookmark,
    prevBookmark,
    cleanStaleBookmarks,
    getValidBookmarks,
  };
}
