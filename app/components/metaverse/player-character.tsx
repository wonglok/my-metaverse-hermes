import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

interface PlayerCharacterProps {
  walkAnimation: number;
  color?: string;
}

/**
 * Local player mesh with walk cycle animation.
 * RoundedBoxGeometry body/arms/head matching vanilla code style.
 */
export function PlayerCharacter({
  walkAnimation,
  color = "#ff637e",
}: PlayerCharacterProps) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.y = Math.abs(Math.sin(walkAnimation)) * 0.6;
    meshRef.current.rotation.x = Math.sin(walkAnimation) * 0.3;
  });

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    shadowSide: 2,
  });

  return (
    <group ref={meshRef}>
      {/* Body */}
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.75, 0]}
        geometry={new RoundedBoxGeometry(1.0, 2.0, 1.0, 10, 0.5)}
        material={material}
      />

      {/* Arms */}
      <mesh
        castShadow
        receiveShadow
        rotation-x={Math.PI / 2}
        position={[0, 1.25, 0]}
        geometry={new RoundedBoxGeometry(0.5, 2.0, 0.5, 10, 0.5)}
        material={material}
      />

      {/* Head */}
      <mesh
        castShadow
        receiveShadow
        position={[0, 2, 0]}
        geometry={new THREE.SphereGeometry(0.5)}
        material={material}
      />
    </group>
  );
}
