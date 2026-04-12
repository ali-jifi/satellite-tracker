import { useCallback } from 'react';
import useAppStore from '../stores/appStore';
import useSatelliteStore from '../stores/satelliteStore';

// bookmark helper hook w/ next/prev cycling and stale id filtering
export default function useBookmarks() {
  const bookmarks = useAppStore((s) => s.bookmarks);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const setBookmarks = useAppStore((s) => s.setBookmarks);

  // get valid bookmarks filtered against current catalog
  const getValidBookmarks = useCallback(() => {
    const satellites = useSatelliteStore.getState().satellites;
    return bookmarks.filter((id) => satellites.has(id));
  }, [bookmarks]);

  // select next bookmarked sat
  const nextBookmark = useCallback(() => {
    const valid = getValidBookmarks();
    if (valid.length === 0) return;

    const currentId = useSatelliteStore.getState().detailSatelliteId;
    const idx = currentId != null ? valid.indexOf(currentId) : -1;
    const next = (idx + 1) % valid.length;
    useSatelliteStore.getState().setDetailSatelliteId(valid[next]);
  }, [getValidBookmarks]);

  // select prev bookmarked sat
  const prevBookmark = useCallback(() => {
    const valid = getValidBookmarks();
    if (valid.length === 0) return;

    const currentId = useSatelliteStore.getState().detailSatelliteId;
    const idx = currentId != null ? valid.indexOf(currentId) : -1;
    const prev = idx <= 0 ? valid.length - 1 : idx - 1;
    useSatelliteStore.getState().setDetailSatelliteId(valid[prev]);
  }, [getValidBookmarks]);

  // remove stale bookmark ids not in catalog
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
