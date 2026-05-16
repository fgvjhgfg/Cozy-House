import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ROOM_HUG_MAX: Record<string, number> = {
  'Room1Scene': 3,
  'Room2Scene': 4,
  'Room3Scene': 4,
};

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
        
        // Check if we already have this exact pose (hugId = 'pose1', 'pose2', etc.)
        const hasHug = roomHugs.includes(hugId);
        
        if (!hasHug) {
          const newHugs = [...roomHugs, hugId];
          let newDoorState = { ...state.doorOpened };
          let newUnlockedRooms = [...state.unlockedRooms];
          
          const max = ROOM_HUG_MAX[room] ?? 4;
          if (newHugs.length >= max) {
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
