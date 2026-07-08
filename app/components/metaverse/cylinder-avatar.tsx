import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Center, Text3D } from "@react-three/drei";
import { helveticaReglar } from "./helvetica";
import { PlayerCharacter } from "./player-character";

interface CylinderAvatarProps {
  color: string;
  position?: [number, number, number];
  rotation?: number;
  isLocal?: boolean;
  name?: string;
}

const LERP_FACTOR = 0.15;

export function CylinderAvatar({
  color,
  position = [0, 0, 0],
  rotation = 0,
  isLocal = false,
  name,
}: CylinderAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const targetPos = useRef(new THREE.Vector3(...position));
  const currentPos = useRef(new THREE.Vector3(...position));
  const targetRot = useRef(rotation);
  const currentRot = useRef(rotation);

  const [state] = useState({ walkAnimation: 0 });

  useEffect(() => {
    targetPos.current.set(...position);
    targetRot.current = rotation;
  }, [position, rotation]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (!currentRot.current) {
      return;
    }
    if (!targetPos.current) {
      return;
    }

    //
    //

    if (currentPos.current.distanceTo(targetPos.current) >= 0.5) {
      state.walkAnimation = 1.0;
    } else {
      state.walkAnimation = 0.0;
    }

    const t = 1 - Math.exp(-LERP_FACTOR * delta * 60);
    currentPos.current.lerp(targetPos.current, t);

    currentRot.current = THREE.MathUtils.lerp(
      currentRot.current,
      targetRot.current,
      t,
    );
    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentRot.current;

    //
  });

  return (
    <group ref={groupRef}>
      <group position={[0, 0, 0]}>
        {/* <mesh ref={bodyRef} castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.35, 0.4, 1.2, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>

        <mesh ref={headRef} castShadow position={[0, 1.425, 0]}>
          <cylinderGeometry args={[0.25, 0.28, 0.45, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>

        <mesh position={[0.08, 1.5, 0.22]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh position={[-0.08, 1.5, 0.22]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="white" />
        </mesh>

        <mesh position={[0, 0.8, 0.38]}>
          <boxGeometry args={[0.12, 0.06, 0.08]} />
          <meshStandardMaterial
            color={isLocal ? "#ffffff" : "#000000"}
            roughness={0.3}
          />
        </mesh> */}

        <group rotation={[0, Math.PI * 0.5, 0]}>
          <PlayerCharacter isMe={false} state={state} />
        </group>

        {name && (
          <group
            position={[0, 1.85 + 1, 0]}
            rotation={[0, Math.PI * -0.5, 0]}
            scale={[1, 1, 1]}
          >
            <Center key={name}>
              <Text3D font={helveticaReglar as any}>
                {name}

                <meshStandardMaterial></meshStandardMaterial>
              </Text3D>
            </Center>
          </group>
        )}
      </group>
    </group>
  );
}

/** Static cylinder avatar without physics: used for remote players. */
export function RemoteCylinderAvatar({
  player,
}: {
  player: {
    targetX: number;
    targetY: number;
    targetZ: number;
    targetRotation: number;
    color: string;
    name: string;
  };
}) {
  return (
    <CylinderAvatar
      color={player.color}
      position={[player.targetX, player.targetY, player.targetZ]}
      rotation={player.targetRotation}
      name={player.name}
    />
  );
}
