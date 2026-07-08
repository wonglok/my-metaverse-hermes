import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
// import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Center, Gltf, Text3D, useFBX, useGLTF } from "@react-three/drei";
import { helveticaReglar } from "./helvetica";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PlayerPhysicsState } from "./physics";

interface PlayerCharacterProps {
  state: PlayerPhysicsState | { walkAnimation: number };
  isMe: boolean;
}

let useFBXAction = (
  fbxURL: string,
  mixer: THREE.AnimationMixer,
  scene: THREE.Scene | THREE.Object3D,
) => {
  let fbx = useFBX(fbxURL);

  let [action, setAction] = useState<THREE.AnimationAction | null>(null);

  useEffect(() => {
    let action = mixer.clipAction(fbx.animations[0]);
    action.stop();
    action.repetitions = Infinity;
    action.play();
    setAction(action);
  }, [fbx, mixer, scene]);

  return action;
};

/**
 * Local player mesh with walk cycle animation.
 * RoundedBoxGeometry body/arms/head matching vanilla code style.
 */
export function PlayerCharacter({ state, isMe = true }: PlayerCharacterProps) {
  const meshRef = useRef<THREE.Group>(null);

  let name = "me";

  let gltf = useGLTF(`/assets/avatar/lamb/lamb-in-beach-transformed.glb`);

  let clonedScene = useMemo(() => {
    return clone(gltf.scene);
  }, [gltf.scene]);

  let show = useMemo(() => {
    return <primitive object={clonedScene}></primitive>;
  }, [clonedScene]);

  let mixer = useMemo(() => {
    return new THREE.AnimationMixer(clonedScene);
  }, [clonedScene]);

  useFrame(() => {
    mixer.setTime(new Date().getTime() / 1000);
  });

  let fbx = {
    run: useFBXAction(
      `/assets/avatar/lamb/motion/running.fbx`,
      mixer,
      clonedScene,
    ),
    idle: useFBXAction(
      `/assets/avatar/lamb/motion/idle.fbx`,
      mixer,
      clonedScene,
    ),
  };

  useFrame(() => {
    if (clonedScene) {
      clonedScene.rotation.x = Math.PI * -0.5;
    }

    if (state.walkAnimation === 0) {
      if (fbx.idle) {
        fbx.idle.weight = THREE.MathUtils.lerp(fbx.idle.weight, 1, 0.1);
      }
      if (fbx.run) {
        fbx.run.weight = THREE.MathUtils.lerp(fbx.run.weight, 0, 0.1);
      }
    } else {
      if (fbx.idle) {
        fbx.idle.weight = THREE.MathUtils.lerp(fbx.idle.weight, 0, 0.1);
      }
      if (fbx.run) {
        fbx.run.weight = THREE.MathUtils.lerp(fbx.run.weight, 1, 0.1);
      }
    }
  });

  return (
    <group ref={meshRef}>
      <group rotation={[0, 0, 0]} scale={2}>
        {show}
      </group>

      {name && isMe && (
        <group rotation={[0, 0, 0]} position={[0, 3, 0]} scale={[1, 1, 1]}>
          <Center key={name}>
            <Text3D font={helveticaReglar as any}>
              {name}
              <meshStandardMaterial></meshStandardMaterial>
            </Text3D>
          </Center>
        </group>
      )}
    </group>
  );
}
