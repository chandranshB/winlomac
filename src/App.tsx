import { KeyboardControls } from '@react-three/drei';
import type { KeyboardControlsEntry } from '@react-three/drei';
import { useStore } from './store/useStore';
import { GameScene } from './game/Scene';
import Lobby from './components/Lobby';
import HUD from './components/HUD';
import LoadingScreen from './components/LoadingScreen';

// Define the keys globally for the controller mappings
const keyMap: KeyboardControlsEntry<string>[] = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'brake', keys: ['Space'] },
  { name: 'nitro', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'reset', keys: ['KeyR'] },
];

function App() {
  const status = useStore((state) => state.status);

  return (
    <KeyboardControls map={keyMap}>
      <div className="w-full h-screen bg-zinc-950 font-sans text-white overflow-hidden relative">
        {/* Connection Setup Lobby Overlay */}
        {status !== 'playing' && <Lobby />}

        {/* Live HUD (Only visible when connected/playing) */}
        {status === 'playing' && <HUD />}

        {/* Global Loading Screen Overlay (Displays while GLTF/Assets are downloading into React Three Fiber) */}
        {status === 'playing' && <LoadingScreen />}

        {/* Continuous 3D Canvas rendering under UI layers */}
        {status === 'playing' && <GameScene />}
      </div>
    </KeyboardControls>
  );
}

export default App;
