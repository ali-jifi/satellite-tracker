import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';

// pure side-effect component, renders null -- binds all global keyboard shortcuts
export default function KeyboardShortcuts() {
  useKeyboardShortcuts({
    // space: open search/menu drawer & focus search input
    ' ': () => {
      const { menuOpen, toggleMenu } = useAppStore.getState();
      if (!menuOpen) toggleMenu();
      setTimeout(() => {
        document.querySelector('input[type="text"]')?.focus();
      }, 100);
    },

    // camera modes: 1=free, 2=follow, 3=pov, 4=skydome
    '1': () => useAppStore.getState().setCameraMode('free'),
    '2': () => {
      const detailId = useSatelliteStore.getState().detailSatelliteId;
      if (detailId != null) useAppStore.getState().setCameraMode('follow');
    },
    '3': () => {
      const detailId = useSatelliteStore.getState().detailSatelliteId;
      if (detailId != null) useAppStore.getState().setCameraMode('pov');
    },
    '4': () => {
      const observer = useAppStore.getState().observerLocation;
      if (observer) useAppStore.getState().setCameraMode('skydome');
    },

    // overlay toggles
    'g': () => useAppStore.getState().toggleGroundTracks(),
    'o': () => useAppStore.getState().toggleOrbitLines(),
    'f': () => useAppStore.getState().toggleFootprints(),
    'l': () => useAppStore.getState().toggleLabelsVisible(),
    'd': () => useAppStore.getState().toggleDebrisVisible(),

    // esc: multi-purpose exit (camera > selection > panels)
    'Escape': () => {
      const app = useAppStore.getState();
      const sat = useSatelliteStore.getState();

      if (app.shortcutHelpOpen) {
        app.toggleShortcutHelp();
      } else if (app.cameraMode !== 'free') {
        app.setCameraMode('free');
      } else if (sat.detailSatelliteId != null) {
        sat.clearDetailSatelliteId();
      } else if (app.menuOpen || app.settingsOpen) {
        app.closeAllPanels();
      }
    },

    // bookmarks
    'b': () => {
      const detailId = useSatelliteStore.getState().detailSatelliteId;
      if (detailId != null) {
        useAppStore.getState().toggleBookmark(detailId);
      }
    },
    'n': () => {
      // next bookmark, filter out stale IDs not in catalog
      const { bookmarks } = useAppStore.getState();
      const { satellites, detailSatelliteId, setDetailSatelliteId } = useSatelliteStore.getState();
      const valid = bookmarks.filter((id) => satellites.has(id));
      if (valid.length === 0) return;
      const idx = detailSatelliteId != null ? valid.indexOf(detailSatelliteId) : -1;
      const next = (idx + 1) % valid.length;
      setDetailSatelliteId(valid[next]);
    },
    'p': () => {
      // prev bookmark, filter out stale IDs not in catalog
      const { bookmarks } = useAppStore.getState();
      const { satellites, detailSatelliteId, setDetailSatelliteId } = useSatelliteStore.getState();
      const valid = bookmarks.filter((id) => satellites.has(id));
      if (valid.length === 0) return;
      const idx = detailSatelliteId != null ? valid.indexOf(detailSatelliteId) : -1;
      const prev = idx <= 0 ? valid.length - 1 : idx - 1;
      setDetailSatelliteId(valid[prev]);
    },

    // HUD toggle (POV mode)
    'h': () => useAppStore.getState().toggleHud(),

    // shortcut help overlay (? = Shift+/)
    '?': () => useAppStore.getState().toggleShortcutHelp(),
  });

  return null;
}
