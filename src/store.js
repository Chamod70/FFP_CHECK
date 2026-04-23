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
        'RATE': []
      },
      ffpManualData: [],
      columnWidths: Array(47).fill(120),
      
      setMasterData: (sheetName, data) => set((state) => ({
        masterData: {
          ...state.masterData,
          [sheetName]: data
        }
      })),

      setFfpData: (data) => set({ ffpManualData: data }),
      setColumnWidths: (widths) => set({ columnWidths: widths }),
      
      clearAllData: () => set({ 
        masterData: { 'H.COMP': [], 'MAST': [], 'WBT': [], 'WBT2': [], 'INS': [], 'EXT': [], 'RATE': [] },
        ffpManualData: [],
        columnWidths: Array(47).fill(120)
      })
    }),
    {
      name: 'ffp-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

export default useStore;
