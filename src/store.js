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
      setColumnAlignment: (index, alignment) => set((state) => ({
        columnAlignments: { ...state.columnAlignments, [index]: alignment }
      })),
      setColumnVerticalAlignment: (index, alignment) => set((state) => ({
        columnVerticalAlignments: { ...state.columnVerticalAlignments, [index]: alignment }
      })),
      setHiddenColumns: (columns) => set({ hiddenColumns: columns }),
      setHiddenColumnGroup: (group) => set({ hiddenColumnGroup: group }),
      
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
        hiddenColumns: {}
      })
    }),
    {
      name: 'ffp-storage',
      storage: debouncedAsyncStorage,
    }
  )
);

export default useStore;
