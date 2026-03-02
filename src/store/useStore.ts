import { create } from 'zustand';

export type PlayerData = {
  id: string;
  name: string;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number, number]; // Quaternion
  ready: boolean;
  speed?: number;
  gear?: number | string;
  rpm?: number;
  lap?: number;
  checkpoints: number;
  isStuck?: boolean;
  isDrifting?: boolean;
  carModel?: string;
};

type GameState = {
  // Network/Lobby State
  status: 'menu' | 'hosting' | 'joining' | 'lobby' | 'playing';
  isHost: boolean;
  peerId: string | null;
  lobbyId: string | null;
  playerName: string;
  playerColor: string;
  playerCarModel: string;
  
  // Game State
  players: Record<string, PlayerData>;
  
  // Actions
  setStatus: (status: GameState['status']) => void;
  setConnectionInfo: (peerId: string, isHost: boolean, lobbyId: string) => void;
  setPlayerName: (name: string) => void;
  setPlayerColor: (color: string) => void;
  setPlayerCarModel: (model: string) => void;
  
  addPlayer: (player: PlayerData) => void;
  removePlayer: (id: string) => void;
  updatePlayer: (id: string, data: Partial<PlayerData>) => void;
  setAllPlayers: (players: Record<string, PlayerData>) => void;
};

export const useStore = create<GameState>()((set) => ({
  status: 'menu',
  isHost: false,
  peerId: null,
  lobbyId: null,
  playerName: 'Racer' + Math.floor(Math.random() * 1000),
  playerColor: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
  playerCarModel: 'default',
  
  players: {},

  setStatus: (status) => set({ status }),
  setConnectionInfo: (peerId, isHost, lobbyId) => set({ peerId, isHost, lobbyId }),
  setPlayerName: (playerName) => set({ playerName }),
  setPlayerColor: (playerColor) => set({ playerColor }),
  setPlayerCarModel: (playerCarModel) => set({ playerCarModel }),
  
  addPlayer: (player) => 
    set((state) => ({ 
      players: { ...state.players, [player.id]: player } 
    })),
    
  removePlayer: (id) => 
    set((state) => {
      const newPlayers = { ...state.players };
      delete newPlayers[id];
      return { players: newPlayers };
    }),
    
  updatePlayer: (id, data) => 
    set((state) => {
      if (!state.players[id]) return state;
      return {
        players: {
          ...state.players,
          [id]: { ...state.players[id], ...data }
        }
      };
    }),
    
  setAllPlayers: (players) => set({ players }),
}));
