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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ffp_storage_saved', {
        detail: { timestamp: new Date().toLocaleTimeString() }
      }));
    }
  }
};

export const saveOfflineEmergencySnapshot = async (reason = 'network_offline') => {
  try {
    await flushStorage();
    const raw = await idbStorage.getItem('ffp-storage');
    if (!raw) return;
    const now = new Date();
    const snapshotMeta = {
      timestamp: now.toISOString(),
      displayTime: now.toLocaleString(),
      reason: reason
    };
    await idbStorage.setItem('ffp_offline_emergency_snapshot', raw);
    try {
      localStorage.setItem('ffp_offline_emergency_snapshot_meta', JSON.stringify(snapshotMeta));
    } catch (e) {}
    console.log(`[FFP Offline Protection] Emergency snapshot created at ${snapshotMeta.displayTime} (${reason})`);
  } catch (err) {
    console.warn('[FFP Offline Protection] Failed to create emergency snapshot:', err);
  }
};

export const getOfflineEmergencySnapshotMeta = () => {
  try {
    const raw = localStorage.getItem('ffp_offline_emergency_snapshot_meta');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const restoreOfflineEmergencySnapshot = async () => {
  const snapshot = await idbStorage.getItem('ffp_offline_emergency_snapshot');
  if (!snapshot) return false;
  let parsed = snapshot;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return false;
    }
  }
  const stateData = parsed.state || parsed;
  if (stateData) {
    const store = useStore.getState();
    if (stateData.masterData) store.setAllMasterData(stateData.masterData);
    if (stateData.ffpManualData) store.setFfpData(stateData.ffpManualData);
    if (stateData.backupData) store.setBackupData(stateData.backupData);
    store.restoreAllLayoutSettings(stateData);
    await flushStorage();
    return true;
  }
  return false;
};

if (typeof window !== 'undefined') {
  // Immediately flush to disk and create safety snapshot when network disconnects
  window.addEventListener('offline', () => {
    console.warn('[FFP Offline Protection] Network offline event detected! Flushing storage immediately.');
    flushStorage();
    saveOfflineEmergencySnapshot('network_offline');
  });

  // Flush on tab close, page navigation, or backgrounding
  window.addEventListener('beforeunload', () => {
    flushStorage();
  });

  window.addEventListener('pagehide', () => {
    flushStorage();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushStorage();
    }
  });

  window.addEventListener('blur', () => {
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
