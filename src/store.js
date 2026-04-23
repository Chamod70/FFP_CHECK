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
      
      setMasterData: (sheetName, data) => set((state) => ({
        masterData: {
          ...state.masterData,
          [sheetName]: data
        }
      })),

      setFfpData: (data) => set({ ffpManualData: data }),
      
      clearAllData: () => set({ 
        masterData: { 'H.COMP': [], 'MAST': [], 'WBT': [], 'WBT2': [], 'INS': [], 'EXT': [], 'RATE': [] },
        ffpManualData: [] 
      })
    }),
    {
      name: 'ffp-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

export default useStore;
