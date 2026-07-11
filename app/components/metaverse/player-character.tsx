import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
// import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Center, Gltf, Text3D, useFBX, useGLTF } from "@react-three/drei";
import { helveticaReglar } from "./helvetica";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PlayerPhysicsState } from "./physics";
import { VRMAvatar } from "./VRMAvatar";
import { useAvatarStore } from "@/stores/avatar";

const DEFAULT_AVATAR_URL =
  "https://d2upc1jytt7esc.cloudfront.net/vrm-avatars/100avatars-r2/SaltySalt/model.vrm";

/**
 * Local player mesh with walk cycle animation.
 * RoundedBoxGeometry body/arms/head matching vanilla code style.
 */
export function PlayerCharacter(props: PlayerCharacterProps) {
  const storedUrl = useAvatarStore((s) => s.avatarUrl);
  const avatarUrl = props.avatarUrl ?? storedUrl ?? DEFAULT_AVATAR_URL;

  return (
    <>
      <VRMAvatar {...props} state={props.state} avatarUrl={avatarUrl} />
    </>
  );
}

interface PlayerCharacterProps {
  name?: string;
  state: PlayerPhysicsState | { walkAnimation: number };
  isMe: boolean;
  spacePressedRef?: React.RefObject<boolean>;
  avatarUrl?: string | null;
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

export function LambAvatar({
  name = "me",
  state,
  isMe = true,
  spacePressedRef,
}: PlayerCharacterProps) {
  const meshRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(`/assets/avatar/lamb/lamb-in-beach-transformed.glb`);

  let clonedScene = useMemo(() => {
    return clone(gltf.scene);
  }, [gltf.scene]);

  let show = useMemo(() => {
    clonedScene.traverse((it) => {
      it.receiveShadow = true;
      it.castShadow = true;
    });
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
    jump: useFBXAction(
      `/assets/avatar/lamb/motion/jump.fbx`,
      mixer,
      clonedScene,
    ),
  };

  const jumpTimer = useRef(0);

  useFrame((_, delta) => {
    if (clonedScene) {
      clonedScene.rotation.x = Math.PI * -0.5;
    }

    // Trigger jump animation from keyboard/joystick input, hold for 0.4s
    if (spacePressedRef?.current) {
      jumpTimer.current = 0.4;
    }
    jumpTimer.current = Math.max(0, jumpTimer.current - delta);

    const isOnGround = "isOnGround" in state ? state.isOnGround : true;
    const jumping =
      jumpTimer.current > 0 ||
      (!isMe && !isOnGround) ||
      spacePressedRef?.current;

    console.log(spacePressedRef?.current);

    const walking = state.walkAnimation !== 0;

    const targetIdle = !jumping && !walking ? 1 : 0;
    const targetRun = !jumping && walking ? 1 : 0;
    const targetJump = jumping ? 1 : 0;

    if (fbx.idle) {
      fbx.idle.weight = THREE.MathUtils.lerp(fbx.idle.weight, targetIdle, 0.2);
    }
    if (fbx.run) {
      fbx.run.weight = THREE.MathUtils.lerp(fbx.run.weight, targetRun, 0.2);
    }
    if (fbx.jump) {
      fbx.jump.weight = THREE.MathUtils.lerp(fbx.jump.weight, targetJump, 0.2);
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
