import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Center, Text3D, useFBX, useGLTF } from "@react-three/drei";
import { helveticaReglar } from "./helvetica.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PlayerPhysicsState } from "./physics.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

interface FBXAvatarProps {
  name?: string;
  state?: PlayerPhysicsState | { walkAnimation: number };
  isMe?: boolean;
  spacePressedRef?: React.MutableRefObject<boolean>;
  avatarUrl?: string | null;
}

let _useFBXAction = (fbxURL: string, mixer: THREE.AnimationMixer) => {
  let fbx = useFBX(fbxURL);
  let [action, setAction] = useState<THREE.AnimationAction | null>(null);

  useEffect(() => {
    let a = mixer.clipAction(fbx.animations[0]);
    a.stop();
    a.repetitions = Infinity;
    a.play();
    setAction(a);
  }, [fbx, mixer]);

  return action;
};

function DefaultAvatar({
  name = "me",
  state,
  isMe = true,
  spacePressedRef,
}: FBXAvatarProps) {
  const meshRef = useRef<THREE.Group>(null);
  const gltf = useGLTF("/assets/avatar/lamb/lamb-in-beach-transformed.glb");
  const clonedScene = useMemo(() => clone(gltf.scene), [gltf.scene]);

  const show = useMemo(() => {
    clonedScene.traverse((it) => {
      it.receiveShadow = true;
      it.castShadow = true;
    });
    return <primitive object={clonedScene} />;
  }, [clonedScene]);

  const mixer = useMemo(
    () => new THREE.AnimationMixer(clonedScene),
    [clonedScene],
  );

  useFrame(() => {
    mixer.setTime(new Date().getTime() / 1000);
  });

  const fbx = {
    run: _useFBXAction("/assets/avatar/lamb/motion/running.fbx", mixer),
    idle: _useFBXAction("/assets/avatar/lamb/motion/idle.fbx", mixer),
    jump: _useFBXAction("/assets/avatar/lamb/motion/jump.fbx", mixer),
  };

  const jumpTimer = useRef(0);

  useFrame((_, delta) => {
    if (clonedScene) {
      clonedScene.rotation.x = Math.PI * -0.5;
    }

    if (spacePressedRef?.current) {
      jumpTimer.current = 0.4;
    }
    jumpTimer.current = Math.max(0, jumpTimer.current - delta);

    const isOnGround = state && "isOnGround" in state ? state.isOnGround : true;
    const jumping =
      jumpTimer.current > 0 ||
      (!isMe && !isOnGround) ||
      spacePressedRef?.current;
    const walking = state ? state.walkAnimation !== 0 : false;

    const targetIdle = !jumping && !walking ? 1 : 0;
    const targetRun = !jumping && walking ? 1 : 0;
    const targetJump = jumping ? 1 : 0;

    if (fbx.idle)
      fbx.idle.weight = THREE.MathUtils.lerp(fbx.idle.weight, targetIdle, 0.2);
    if (fbx.run)
      fbx.run.weight = THREE.MathUtils.lerp(fbx.run.weight, targetRun, 0.2);
    if (fbx.jump)
      fbx.jump.weight = THREE.MathUtils.lerp(fbx.jump.weight, targetJump, 0.2);
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
              <meshStandardMaterial />
            </Text3D>
          </Center>
        </group>
      )}
    </group>
  );
}

function FBXModel({
  url,
  state,
  isMe = false,
  spacePressedRef,
}: { url: string } & FBXAvatarProps) {
  const meshRef = useRef<THREE.Group>(null);
  const fbx = useFBX(url);
  const clonedScene = useMemo(() => clone(fbx), [fbx]);

  useEffect(() => {
    clonedScene.traverse((it) => {
      it.receiveShadow = true;
      it.castShadow = true;
    });
  }, [clonedScene]);

  const mixer = useMemo(
    () => new THREE.AnimationMixer(clonedScene),
    [clonedScene],
  );

  const [actions, setActions] = useState<{
    idle?: THREE.AnimationAction | null;
    jump?: THREE.AnimationAction | null;
    run?: THREE.AnimationAction | null;
    walk?: THREE.AnimationAction | null;
  }>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loadFbxAnimation = async (animUrl: string) => {
        const blob = await fetch(animUrl).then((r) => r.blob());
        const objUrl = URL.createObjectURL(blob);
        const loader = new FBXLoader();
        try {
          const asset = await new Promise<THREE.Group>((resolve, reject) => {
            loader.load(objUrl, resolve, undefined, reject);
          });
          return asset.animations[0];
        } finally {
          URL.revokeObjectURL(objUrl);
        }
      };

      const [idleClip, jumpClip, runClip, walkClip] = await Promise.all([
        loadFbxAnimation("/assets/vrm/motion/idle.fbx"),
        loadFbxAnimation("/assets/vrm/motion/jump.fbx"),
        loadFbxAnimation("/assets/vrm/motion/running.fbx"),
        loadFbxAnimation("/assets/vrm/motion/walking.fbx"),
      ]);

      if (cancelled) return;

      const idle = mixer.clipAction(idleClip);
      const jump = mixer.clipAction(jumpClip);
      const run = mixer.clipAction(runClip);
      const walk = mixer.clipAction(walkClip);

      [idle, jump, run, walk].forEach((a) => {
        a.stop();
        a.repetitions = Infinity;
        a.play();
      });

      setActions({ idle, jump, run, walk });
    })();

    return () => {
      cancelled = true;
    };
  }, [mixer]);

  const jumpTimer = useRef(0);

  useFrame((_, delta) => {
    if (clonedScene) {
      clonedScene.rotation.x = Math.PI * -0.5;
    }

    if (spacePressedRef?.current) {
      jumpTimer.current = 0.4;
    }
    jumpTimer.current = Math.max(0, jumpTimer.current - delta);

    const isOnGround = state && "isOnGround" in state ? state.isOnGround : true;
    const jumping =
      jumpTimer.current > 0 ||
      (!isMe && !isOnGround) ||
      spacePressedRef?.current;
    const speed = state ? Math.abs(state.walkAnimation) : 0;
    const walking = speed > 0;
    const blendFactor = Math.min(speed / 0.7, 1);

    const targetIdle = !jumping && !walking ? 1 : 0;
    const targetJump = jumping ? 1 : 0;
    const targetWalk = !jumping && walking ? 1 - blendFactor : 0;
    const targetRun = !jumping && walking ? blendFactor : 0;

    if (actions.idle)
      actions.idle.weight = THREE.MathUtils.lerp(
        actions.idle.weight,
        targetIdle,
        0.2,
      );
    if (actions.jump)
      actions.jump.weight = THREE.MathUtils.lerp(
        actions.jump.weight,
        targetJump,
        0.2,
      );
    if (actions.walk) {
      actions.walk.weight = THREE.MathUtils.lerp(
        actions.walk.weight,
        targetWalk,
        0.2,
      );
    }
    if (actions.run) {
      actions.run.weight = THREE.MathUtils.lerp(
        actions.run.weight,
        targetRun,
        0.2,
      );
    }

    mixer.update(delta);
  });

  return (
    <group ref={meshRef}>
      <group rotation={[Math.PI * 0.5, 0, 0]} scale={1}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

export function FBXAvatar(props: FBXAvatarProps) {
  const { avatarUrl } = props;

  if (avatarUrl) {
    return (
      <Suspense fallback={<DefaultAvatar {...props} />}>
        <FBXModel url={avatarUrl} {...props} />
      </Suspense>
    );
  }

  return <DefaultAvatar {...props} />;
}
