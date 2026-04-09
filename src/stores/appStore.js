import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  // CesiumJS viewer reference (imperative bridge)
  viewerRef: null,
  setViewerRef: (viewer) => set({ viewerRef: viewer }),

  // Loading state
  isLoading: true,
  setLoading: (loading) => set({ isLoading: loading }),

  // UI panels
  menuOpen: false,
  settingsOpen: false,
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen, settingsOpen: false })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen, menuOpen: false })),
  closeAllPanels: () => set({ menuOpen: false, settingsOpen: false }),

  // Observer location: { lat, lon, label } or null
  observerLocation: null,
  locationPromptOpen: false,
  setObserverLocation: (loc) => set({ observerLocation: loc, locationPromptOpen: false }),
  openLocationPrompt: () => set({ locationPromptOpen: true }),
  closeLocationPrompt: () => set({ locationPromptOpen: false }),

  // Globe settings
  gridLinesVisible: false,
  toggleGridLines: () => set((s) => ({ gridLinesVisible: !s.gridLinesVisible })),

  // Visibility toggles
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

  // Globe style & visual options
  globeStyle: 'photo', // 'photo' | 'daynight' | 'dark'
  setGlobeStyle: (style) => set({ globeStyle: style }),
  atmosphereEnabled: false,
  toggleAtmosphere: () => set((s) => ({ atmosphereEnabled: !s.atmosphereEnabled })),
  cloudsEnabled: false,
  toggleClouds: () => set((s) => ({ cloudsEnabled: !s.cloudsEnabled })),

  // Simulation time state (mirrors CesiumJS Clock for React reactivity)
  simSpeed: 1,
  simPlaying: true,
  simDirection: 1, // 1 = forward, -1 = rewind
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

  // Space-Track credentials
  spaceTrackCredentials: null,
  setSpaceTrackCredentials: (creds) => set({ spaceTrackCredentials: creds }),
  spaceTrackEnabled: false,
  setSpaceTrackEnabled: (enabled) => set({ spaceTrackEnabled: enabled }),
}));

export default useAppStore;
