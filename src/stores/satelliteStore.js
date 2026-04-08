import { create } from 'zustand';

const MAX_SELECTED = 20;

const useSatelliteStore = create((set, get) => ({
  // === Catalog state ===
  satellites: new Map(),
  satelliteArray: [],
  catalogLoaded: false,
  loadProgress: 0,
  lastFetchTime: null,

  // === Catalog actions ===
  addSatellites: (satArray) =>
    set((state) => {
      const updated = new Map(state.satellites);
      const catIndex = new Map(state.categoryIndex);
      const cntIndex = new Map(state.countryIndex);

      for (const sat of satArray) {
        if (!updated.has(sat.id)) {
          updated.set(sat.id, sat);

          // Category index
          if (sat.category) {
            if (!catIndex.has(sat.category)) {
              catIndex.set(sat.category, new Set());
            }
            catIndex.get(sat.category).add(sat.id);
          }

          // Country index
          if (sat.countryCode) {
            if (!cntIndex.has(sat.countryCode)) {
              cntIndex.set(sat.countryCode, new Set());
            }
            cntIndex.get(sat.countryCode).add(sat.id);
          }
        }
      }

      return {
        satellites: updated,
        satelliteArray: Array.from(updated.values()),
        categoryIndex: catIndex,
        countryIndex: cntIndex,
      };
    }),

  setCatalogLoaded: (loaded) =>
    set({ catalogLoaded: loaded, lastFetchTime: loaded ? Date.now() : null }),

  setLoadProgress: (count) => set({ loadProgress: count }),

  // === Selection state (multi-select, max 20) ===
  selectedIds: new Set(),

  selectSatellite: (id) =>
    set((state) => {
      if (state.selectedIds.size >= MAX_SELECTED) return state;
      if (state.selectedIds.has(id)) return state;
      const next = new Set(state.selectedIds);
      next.add(id);
      return { selectedIds: next };
    }),

  deselectSatellite: (id) =>
    set((state) => {
      if (!state.selectedIds.has(id)) return state;
      const next = new Set(state.selectedIds);
      next.delete(id);
      return { selectedIds: next };
    }),

  toggleSatellite: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECTED) return state;
        next.add(id);
      }
      return { selectedIds: next };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  isSelected: (id) => get().selectedIds.has(id),

  // === Filter state (solo mode) ===
  activeFilter: null,

  setFilter: (filter) => set({ activeFilter: filter }),
  clearFilter: () => set({ activeFilter: null }),

  // === Color mode state ===
  colorMode: 'inclination',

  setColorMode: (mode) => set({ colorMode: mode }),

  // === Category and country indexes ===
  categoryIndex: new Map(),
  countryIndex: new Map(),
}));

export default useSatelliteStore;
