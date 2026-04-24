import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import idbStorage from './idb-storage';

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
      columnWidths: Array(47).fill(120),
      customHeaders: {},
      columnAlignments: {},
      columnVerticalAlignments: {},
      
      setMasterData: (sheetName, data) => set((state) => ({
        masterData: {
          ...state.masterData,
          [sheetName]: data
        }
      })),

      setFfpData: (data) => set({ ffpManualData: data }),
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
      
      clearAllData: () => set({ 
        masterData: { 
          'H.COMP': [], 'MAST': [], 'WBT': [], 'WBT2': [], 
          'INS': [], 'EXT': [], 'RATE': [], 'DATE': [], 'WBT UPT': [] 
        },
        ffpManualData: [],
        columnWidths: Array(47).fill(120),
        customHeaders: {},
        columnAlignments: {},
        columnVerticalAlignments: {}
      })
    }),
    {
      name: 'ffp-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

export default useStore;
