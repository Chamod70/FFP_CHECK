import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import idbStorage from './idb-storage';

let pendingSaveTimeout = null;
let pendingState = null;

export const flushStorage = async () => {
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
    pendingSaveTimeout = null;
  }
  if (pendingState !== null) {
    const toSave = pendingState;
    pendingState = null;
    await idbStorage.setItem('ffp-storage', toSave);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushStorage();
  });
}

const debouncedAsyncStorage = {
  getItem: async (name) => {
    if (pendingState !== null && name === 'ffp-storage') {
      return pendingState;
    }
    const data = await idbStorage.getItem(name);
    if (!data) return null;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return data;
  },
  setItem: (name, value) => {
    if (name !== 'ffp-storage') {
      return idbStorage.setItem(name, value);
    }
    pendingState = value;
    if (pendingSaveTimeout) {
      clearTimeout(pendingSaveTimeout);
    }
    pendingSaveTimeout = setTimeout(() => {
      flushStorage();
    }, 800);
  },
  removeItem: async (name) => {
    if (pendingSaveTimeout) {
      clearTimeout(pendingSaveTimeout);
      pendingSaveTimeout = null;
    }
    pendingState = null;
    await idbStorage.removeItem(name);
  }
};

const useStore = create(
  persist(
    (set) => ({
      masterData: {
        'H.COMP': [],
        'MAST': [],
        'WBT': [],
        'WBT2': [],
        'INS': [],
        'EXT': [],
        'RATE': [],
        'DATE': [],
        'WBT UPT': []
      },
      ffpManualData: [],
      backupData: [],
      columnWidths: Array(47).fill(120),
      customHeaders: {},
      columnAlignments: {},
      columnVerticalAlignments: {},
      hiddenColumns: {},
      hiddenColumnGroup: {},
      showHideGroupBar: (() => {
        try {
          const saved = localStorage.getItem('ffp_show_hide_group_bar');
          return saved !== null ? JSON.parse(saved) : true;
        } catch { return true; }
      })(),
      
      setMasterData: (sheetName, data) => set((state) => ({
        masterData: {
          ...state.masterData,
          [sheetName]: data
        }
      })),
      setAllMasterData: (data) => set({ masterData: data }),

      setFfpData: (data) => set({ ffpManualData: data }),
      setBackupData: (data) => set({ backupData: data }),
      addToBackupData: (newData) => set((state) => ({ 
        backupData: [...state.backupData, ...newData] 
      })),
      setColumnWidths: (widths) => set({ columnWidths: widths }),
      setCustomHeader: (index, value) => set((state) => ({
        customHeaders: { ...state.customHeaders, [index]: value }
      })),
      setCustomHeaders: (headers) => set({ customHeaders: headers || {} }),
      setColumnAlignment: (index, alignment) => set((state) => ({
        columnAlignments: { ...state.columnAlignments, [index]: alignment }
      })),
      setColumnAlignments: (alignments) => set({ columnAlignments: alignments || {} }),
      setColumnVerticalAlignment: (index, alignment) => set((state) => ({
        columnVerticalAlignments: { ...state.columnVerticalAlignments, [index]: alignment }
      })),
      setColumnVerticalAlignments: (vertAlignments) => set({ columnVerticalAlignments: vertAlignments || {} }),
      setHiddenColumns: (columns) => set({ hiddenColumns: columns || {} }),
      setHiddenColumnGroup: (group) => set({ hiddenColumnGroup: group || {} }),
      setShowHideGroupBar: (val) => set((state) => {
        const next = typeof val === 'function' ? val(state.showHideGroupBar) : val;
        try {
          localStorage.setItem('ffp_show_hide_group_bar', JSON.stringify(next));
        } catch (e) {}
        return { showHideGroupBar: next };
      }),
      restoreAllLayoutSettings: (settings) => set((state) => {
        if (!settings) return {};
        const nextShowHideGroupBar = settings.showHideGroupBar !== undefined 
          ? settings.showHideGroupBar 
          : state.showHideGroupBar;
        try {
          if (settings.showHideGroupBar !== undefined) {
            localStorage.setItem('ffp_show_hide_group_bar', JSON.stringify(settings.showHideGroupBar));
          }
        } catch (e) {}
        return {
          columnWidths: settings.columnWidths && Array.isArray(settings.columnWidths) ? settings.columnWidths : state.columnWidths,
          customHeaders: settings.customHeaders !== undefined ? settings.customHeaders : state.customHeaders,
          columnAlignments: settings.columnAlignments !== undefined ? settings.columnAlignments : state.columnAlignments,
          columnVerticalAlignments: settings.columnVerticalAlignments !== undefined ? settings.columnVerticalAlignments : state.columnVerticalAlignments,
          hiddenColumns: settings.hiddenColumns !== undefined ? settings.hiddenColumns : state.hiddenColumns,
          hiddenColumnGroup: settings.hiddenColumnGroup !== undefined ? settings.hiddenColumnGroup : state.hiddenColumnGroup,
          showHideGroupBar: nextShowHideGroupBar
        };
      }),
      
      clearAllData: () => set({ 
        masterData: { 
          'H.COMP': [], 'MAST': [], 'WBT': [], 'WBT2': [], 
          'INS': [], 'EXT': [], 'RATE': [], 'DATE': [], 'WBT UPT': [] 
        },
        ffpManualData: [],
        backupData: [],
        columnWidths: Array(47).fill(120),
        customHeaders: {},
        columnAlignments: {},
        columnVerticalAlignments: {},
        hiddenColumns: {},
        hiddenColumnGroup: {}
      })
    }),
    {
      name: 'ffp-storage',
      storage: debouncedAsyncStorage,
    }
  )
);

export default useStore;
