import { RigidBody } from '@react-three/rapier';

export function Track() {
  return (
    <group>
      {/* Ground plane visuals are now just the floor, track is raised slightly over it */}
      
      {/* Starting Straight / Finish Line */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.9, 0]}>
          <boxGeometry args={[40, 0.4, 200]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        
        {/* Finish Line Marking */}
        <mesh position={[0, -0.69, -50]}>
          <planeGeometry args={[40, 2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </RigidBody>

      {/* Turn 1 (Top curve) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[50, -0.9, -120]} rotation={[0, -Math.PI / 4, 0]}>
          <boxGeometry args={[40, 0.4, 150]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[120, -0.9, -150]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[40, 0.4, 100]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Back Straight */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[200, -0.9, 0]}>
          <boxGeometry args={[40, 0.4, 300]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Turn 2 (Bottom Curve ) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[120, -0.9, 150]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[40, 0.4, 150]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[50, -0.9, 120]} rotation={[0, Math.PI / 2.5, 0]}>
          <boxGeometry args={[40, 0.4, 100]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Track Barriers (Inside & Outside Walls) to keep players from falling off */}
      <group>
        {/* Start Straight Walls */}
        <RigidBody type="fixed" colliders="cuboid" position={[-21, 0, 0]}>
           <mesh><boxGeometry args={[2, 4, 200]}/><meshStandardMaterial color="#ff2222"/></mesh>
        </RigidBody>
        <RigidBody type="fixed" colliders="cuboid" position={[21, 0, 0]}>
           <mesh><boxGeometry args={[2, 4, 200]}/><meshStandardMaterial color="#aaaaaa"/></mesh>
        </RigidBody>
        
        {/* Back Straight Walls */}
        <RigidBody type="fixed" colliders="cuboid" position={[179, 0, 0]}>
           <mesh><boxGeometry args={[2, 4, 300]}/><meshStandardMaterial color="#ff2222"/></mesh>
        </RigidBody>
        <RigidBody type="fixed" colliders="cuboid" position={[221, 0, 0]}>
           <mesh><boxGeometry args={[2, 4, 300]}/><meshStandardMaterial color="#aaaaaa"/></mesh>
        </RigidBody>
      </group>
      
      {/* Add a Ramp / Jump in the middle just for fun! */}
      <RigidBody type="fixed" colliders="cuboid" position={[100, -0.5, 0]} rotation={[Math.PI / 16, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[30, 1, 40]} />
          <meshStandardMaterial color="#ffd700" roughness={0.5} />
        </mesh>
      </RigidBody>
    </group>
  );
}
