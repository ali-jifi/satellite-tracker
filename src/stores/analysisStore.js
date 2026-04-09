import { create } from 'zustand';

const DEFAULT_NOTIFICATION_PREFS = {
  reentryEnabled: true,
  closeApproachEnabled: true,
  photobombEnabled: true,
  leadTimeMinutes: 10,
};

const useAnalysisStore = create((set) => ({
  // Panel visibility (mutually exclusive)
  reentryPanelOpen: false,
  closeApproachPanelOpen: false,
  tleAnalyzerOpen: false,
  photobombPanelOpen: false,
  constellationDashboardOpen: false,

  toggleReentryPanel: () =>
    set((s) => ({
      reentryPanelOpen: !s.reentryPanelOpen,
      closeApproachPanelOpen: false,
      tleAnalyzerOpen: false,
      photobombPanelOpen: false,
      constellationDashboardOpen: false,
    })),
  toggleCloseApproachPanel: () =>
    set((s) => ({
      reentryPanelOpen: false,
      closeApproachPanelOpen: !s.closeApproachPanelOpen,
      tleAnalyzerOpen: false,
      photobombPanelOpen: false,
      constellationDashboardOpen: false,
    })),
  toggleTleAnalyzer: () =>
    set((s) => ({
      reentryPanelOpen: false,
      closeApproachPanelOpen: false,
      tleAnalyzerOpen: !s.tleAnalyzerOpen,
      photobombPanelOpen: false,
      constellationDashboardOpen: false,
    })),
  togglePhotobombPanel: () =>
    set((s) => ({
      reentryPanelOpen: false,
      closeApproachPanelOpen: false,
      tleAnalyzerOpen: false,
      photobombPanelOpen: !s.photobombPanelOpen,
      constellationDashboardOpen: false,
    })),
  toggleConstellationDashboard: () =>
    set((s) => ({
      reentryPanelOpen: false,
      closeApproachPanelOpen: false,
      tleAnalyzerOpen: false,
      photobombPanelOpen: false,
      constellationDashboardOpen: !s.constellationDashboardOpen,
    })),

  closeAllAnalysisPanels: () =>
    set({
      reentryPanelOpen: false,
      closeApproachPanelOpen: false,
      tleAnalyzerOpen: false,
      photobombPanelOpen: false,
      constellationDashboardOpen: false,
    }),

  // Result state
  reentryResults: [],
  closeApproachResults: [],
  transitResults: [],
  constellationData: null,

  // Computing flags
  reentryComputing: false,
  closeApproachComputing: false,
  transitComputing: false,

  setReentryResults: (results) =>
    set({ reentryResults: results, reentryComputing: false }),
  setCloseApproachResults: (results) =>
    set({ closeApproachResults: results, closeApproachComputing: false }),
  setTransitResults: (results) =>
    set({ transitResults: results, transitComputing: false }),
  setConstellationData: (data) => set({ constellationData: data }),

  setReentryComputing: (v) => set({ reentryComputing: v }),
  setCloseApproachComputing: (v) => set({ closeApproachComputing: v }),
  setTransitComputing: (v) => set({ transitComputing: v }),

  // Notification preferences (persisted to localStorage)
  notificationPrefs: JSON.parse(
    localStorage.getItem('sat-notification-prefs') ||
      JSON.stringify(DEFAULT_NOTIFICATION_PREFS)
  ),
  setNotificationPrefs: (prefs) => {
    localStorage.setItem('sat-notification-prefs', JSON.stringify(prefs));
    set({ notificationPrefs: prefs });
  },
}));

export default useAnalysisStore;
