import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Center, Text3D } from "@react-three/drei";
import { helveticaReglar } from "./helvetica";
import { PlayerCharacter } from "./player-character";

interface OtherAvatarProps {
  color: string;
  position?: [number, number, number];
  rotation?: number;
  isLocal?: boolean;
  name?: string;
}

const LERP_FACTOR = 0.15;

export function OtherAvatar({
  position = [0, 0, 0],
  rotation = 0,
  name,
}: OtherAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);

  const currentPos = useRef(new THREE.Vector3(...position));
  const currentRot = useRef(rotation);
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetRot = useRef(rotation);

  const [state] = useState({ walkAnimation: 0, isOnGround: true as boolean });
  const prevTargetY = useRef(targetPos.current.y);

  // Update targets from latest props (not in useEffect, so useFrame always
  // sees current values without a render-commit round-trip)
  targetPos.current.set(...position);
  targetRot.current = rotation;

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (currentPos.current.distanceTo(targetPos.current) >= 0.5) {
      state.walkAnimation = 1.0;
    } else {
      state.walkAnimation = 0.0;
    }

    // Detect jump from vertical position change
    const dy = Math.abs(targetPos.current.y - prevTargetY.current);
    if (dy > 0.05) {
      state.isOnGround = false;
    } else {
      state.isOnGround = true;
    }
    prevTargetY.current = targetPos.current.y;

    const t = 1 - Math.exp(-LERP_FACTOR * delta * 60);
    currentPos.current.lerp(targetPos.current, t);

    currentRot.current = THREE.MathUtils.lerp(
      currentRot.current,
      targetRot.current,
      t,
    );
    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentRot.current;
  });

  return (
    <group ref={groupRef}>
      <group position={[0, 0, 0]}>
        <group rotation={[0, Math.PI * 0.5, 0]}>
          <PlayerCharacter isMe={false} state={state} />
        </group>

        {name && (
          <group
            position={[0, 1.85 + 1, 0]}
            rotation={[0, Math.PI * -1.5, 0]}
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
export function RemoteAvatar({
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
    <OtherAvatar
      color={player.color}
      position={[player.targetX, player.targetY, player.targetZ]}
      rotation={player.targetRotation}
      name={player.name}
    />
  );
}
