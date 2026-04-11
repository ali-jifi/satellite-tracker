import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  // CesiumJS viewer ref (imperative bridge)
  viewerRef: null,
  setViewerRef: (viewer) => set({ viewerRef: viewer }),

  // loading state
  isLoading: true,
  setLoading: (loading) => set({ isLoading: loading }),

  // ui panels
  menuOpen: false,
  settingsOpen: false,
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen, settingsOpen: false })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen, menuOpen: false })),
  closeAllPanels: () => set({ menuOpen: false, settingsOpen: false }),

  // observer location: { lat, lon, label } | null
  observerLocation: null,
  locationPromptOpen: false,
  setObserverLocation: (loc) => set({ observerLocation: loc, locationPromptOpen: false }),
  openLocationPrompt: () => set({ locationPromptOpen: true }),
  closeLocationPrompt: () => set({ locationPromptOpen: false }),

  // globe settings
  gridLinesVisible: false,
  toggleGridLines: () => set((s) => ({ gridLinesVisible: !s.gridLinesVisible })),

  // visibility toggles
  debrisVisible: true,
  toggleDebrisVisible: () => set((s) => ({ debrisVisible: !s.debrisVisible })),
  labelsVisible: true,
  toggleLabelsVisible: () => set((s) => ({ labelsVisible: !s.labelsVisible })),
  groundTracksVisible: true,
  toggleGroundTracks: () => set((s) => ({ groundTracksVisible: !s.groundTracksVisible })),
  orbitLinesVisible: true,
  toggleOrbitLines: () => set((s) => ({ orbitLinesVisible: !s.orbitLinesVisible })),
  footprintsVisible: true,
  toggleFootprints: () => set((s) => ({ footprintsVisible: !s.footprintsVisible })),

  // globe style & visual opts
  globeStyle: 'photo', // 'photo' | 'daynight' | 'dark'
  setGlobeStyle: (style) => set({ globeStyle: style }),
  atmosphereEnabled: false,
  toggleAtmosphere: () => set((s) => ({ atmosphereEnabled: !s.atmosphereEnabled })),
  cloudsEnabled: false,
  toggleClouds: () => set((s) => ({ cloudsEnabled: !s.cloudsEnabled })),

  // sim time state (mirrors CesiumJS Clock for React reactivity)
  simSpeed: 1,
  simPlaying: true,
  simDirection: 1, // 1=fwd, -1=rwd
  setSimSpeed: (speed) => set({ simSpeed: speed }),
  toggleSimPlaying: () => {
    const state = get();
    const viewer = state.viewerRef;
    const next = !state.simPlaying;
    if (viewer) {
      viewer.clock.shouldAnimate = next;
    }
    set({ simPlaying: next });
  },
  setSimDirection: (dir) => set({ simDirection: dir }),

  // camera mode state
  cameraMode: 'free', // 'free' | 'follow' | 'pov' | 'skydome'
  setCameraMode: (mode) => set({ cameraMode: mode }),
  hudVisible: false,
  toggleHud: () => set((s) => ({ hudVisible: !s.hudVisible })),

  // shortcut help overlay
  shortcutHelpOpen: false,
  toggleShortcutHelp: () => set((s) => ({ shortcutHelpOpen: !s.shortcutHelpOpen })),

  // bookmarks (NORAD IDs persisted to localStorage)
  bookmarks: JSON.parse(localStorage.getItem('sat-tracker-bookmarks') || '[]'),
  setBookmarks: (ids) => {
    localStorage.setItem('sat-tracker-bookmarks', JSON.stringify(ids));
    set({ bookmarks: ids });
  },
  toggleBookmark: (id) => {
    const { bookmarks } = get();
    let next;
    if (bookmarks.includes(id)) {
      next = bookmarks.filter((b) => b !== id);
    } else {
      next = [...bookmarks, id];
    }
    localStorage.setItem('sat-tracker-bookmarks', JSON.stringify(next));
    set({ bookmarks: next });
  },

  // theme state (persisted to localStorage)
  theme: localStorage.getItem('sat-tracker-theme') || 'dark',
  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('sat-tracker-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  // Space-Track creds
  spaceTrackCredentials: null,
  setSpaceTrackCredentials: (creds) => set({ spaceTrackCredentials: creds }),
  spaceTrackEnabled: false,
  setSpaceTrackEnabled: (enabled) => set({ spaceTrackEnabled: enabled }),
}));

// apply initial theme to DOM on store creation
document.documentElement.setAttribute('data-theme', useAppStore.getState().theme);

export default useAppStore;
