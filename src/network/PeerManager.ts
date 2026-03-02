import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { useStore } from '../store/useStore';
import type { PlayerData } from '../store/useStore';

type NetworkMessage = 
  | { type: 'STATE_UPDATE', players: Record<string, PlayerData> }
  | { type: 'PLAYER_JOIN', player: PlayerData }
  | { type: 'PLAYER_LEAVE', id: string }
  | { type: 'POSITION_UPDATE', id: string, position: [number, number, number], rotation: [number, number, number, number] }
  | { type: 'START_GAME' };

class PeerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;

  initHost() {
    return new Promise<string>((resolve, reject) => {
      // Generate random lobby ID
      const lobbyId = 'racer-' + Math.random().toString(36).substring(2, 8);
      
      this.peer = new Peer(lobbyId);

      this.peer.on('open', (id) => {
        useStore.getState().setConnectionInfo(id, true, lobbyId);
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Host Error:', err);
        reject(err);
      });

      this.peer.on('connection', (conn) => {
        this.setupHostConnection(conn);
      });
    });
  }

  initClient(lobbyId: string) {
    return new Promise<string>((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        useStore.getState().setConnectionInfo(id, false, lobbyId);
        
        // Connect to the host
        const conn = this.peer!.connect(lobbyId);
        this.setupClientConnection(conn);

        conn.on('open', () => {
          resolve(id);
        });
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Client Error:', err);
        reject(err);
      });
    });
  }

  // --- Host Logic ---
  private setupHostConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('Client connected:', conn.peer);
      this.connections.set(conn.peer, conn);

      // Send current state to new client
      conn.send({
        type: 'STATE_UPDATE',
        players: useStore.getState().players
      });
    });

    conn.on('data', (data: unknown) => {
      const msg = data as NetworkMessage;
      
      if (msg.type === 'PLAYER_JOIN') {
        useStore.getState().addPlayer(msg.player);
        this.broadcast(msg, conn.peer); // relay to others
      }
      else if (msg.type === 'POSITION_UPDATE') {
        useStore.getState().updatePlayer(msg.id, { position: msg.position, rotation: msg.rotation });
        this.broadcast(msg, conn.peer); // relay to others for fast sync
      }
    });

    conn.on('close', () => {
      console.log('Client disconnected:', conn.peer);
      this.connections.delete(conn.peer);
      useStore.getState().removePlayer(conn.peer);
      this.broadcast({ type: 'PLAYER_LEAVE', id: conn.peer });
    });
  }

  // --- Client Logic ---
  private setupClientConnection(conn: DataConnection) {
    this.hostConnection = conn;

    conn.on('data', (data: unknown) => {
      const msg = data as NetworkMessage;
      const state = useStore.getState();

      switch(msg.type) {
        case 'STATE_UPDATE':
          state.setAllPlayers(msg.players);
          break;
        case 'PLAYER_JOIN':
          state.addPlayer(msg.player);
          break;
        case 'PLAYER_LEAVE':
          state.removePlayer(msg.id);
          break;
        case 'POSITION_UPDATE':
          // Update physics position natively if needed, or via react
          state.updatePlayer(msg.id, { position: msg.position, rotation: msg.rotation });
          break;
        case 'START_GAME':
          state.setStatus('playing');
          break;
      }
    });

    conn.on('close', () => {
      console.log('Host disconnected');
      useStore.getState().setStatus('menu');
      alert('Host disconnected.');
    });
  }

  // --- Generic Comms ---
  broadcast(msg: NetworkMessage, excludePeerId?: string) {
    this.connections.forEach((conn, id) => {
      if (id !== excludePeerId) {
        conn.send(msg);
      }
    });
  }

  sendToHost(msg: NetworkMessage) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.hostConnection = null;
  }
}

export const peerManager = new PeerManager();
