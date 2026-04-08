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
  toggleGridLines: () => {
    const { viewerRef, gridLinesVisible } = get();
    if (!viewerRef) return;
    const newVal = !gridLinesVisible;
    set({ gridLinesVisible: newVal });
    // Grid layer toggling will be implemented when grid layer is added
  },
}));

export default useAppStore;
