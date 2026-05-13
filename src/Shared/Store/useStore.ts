import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  character: string | null;
  setCharacter: (char: string) => void;
  currentRoom: string;
  setCurrentRoom: (room: string) => void;
  foundHugs: Record<string, string[]>;
  addHug: (room: string, hugId: string) => void;
  doorOpened: Record<string, boolean>;
  unlockedRooms: string[];
  unlockRoom: (room: string) => void;
  promptText: string;
  setPromptText: (text: string) => void;
}

export const useStore = create<GameState>()(
  persist(
    (set) => ({
      character: null,
      setCharacter: (char) => set({ character: char }),
      
      currentRoom: 'Room1Scene',
      setCurrentRoom: (room) => set({ currentRoom: room }),
      
      foundHugs: { 'Room1Scene': [], 'Room2Scene': [] },
      doorOpened: { 'Room1Scene': false },
      unlockedRooms: ['Room1Scene'],
      unlockRoom: (room) => set((state) => ({ 
        unlockedRooms: state.unlockedRooms.includes(room) ? state.unlockedRooms : [...state.unlockedRooms, room] 
      })),
      
      promptText: '',
      setPromptText: (text) => set({ promptText: text }),
      
      addHug: (room, hugId) => set((state) => {
        const roomHugs = state.foundHugs[room] || [];
        const zone = hugId.split('_')[0]; // e.g. 'standing', 'sofa', 'bed'
        
        // Check if we already have a hug from this zone
        const hasZone = roomHugs.some(id => id.split('_')[0] === zone);
        
        if (!hasZone) {
          const newHugs = [...roomHugs, hugId];
          let newDoorState = { ...state.doorOpened };
          let newUnlockedRooms = [...state.unlockedRooms];
          
          if (newHugs.length >= 3) {
            newDoorState[room] = true;
            if (room === 'Room1Scene' && !newUnlockedRooms.includes('Room2Scene')) {
              newUnlockedRooms.push('Room2Scene');
            }
          }
          return { 
            foundHugs: { ...state.foundHugs, [room]: newHugs },
            doorOpened: newDoorState,
            unlockedRooms: newUnlockedRooms
          };
        }
        return state;
      }),
    }),
    {
      name: 'cozy-house-storage',
      // We don't want to persist character selection or prompt text, just progress.
      partialize: (state) => ({ 
        foundHugs: state.foundHugs, 
        doorOpened: state.doorOpened,
        unlockedRooms: state.unlockedRooms 
      }),
    }
  )
);
