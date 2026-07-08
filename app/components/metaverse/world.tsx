import { DoubleSide, Euler, Vector3 } from "three/webgpu";
// import * as TSL from "three/tsl";
import { extend, type ThreeToJSXElements } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { useRef, useEffect, Suspense, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Sky, Environment, Gltf } from "@react-three/drei";
import type { UseMetaverse } from "@/hooks/use-metaverse";
import { PlayerCharacter } from "./player-character";
import { RemoteCylinderAvatar } from "./cylinder-avatar";
import { KinematicPlatform } from "./kinematic-platform";
import {
  updatePlayerPhysics,
  resetPlayer,
  type PlayerPhysicsState,
  type MovingPlatform,
} from "./physics";
import {
  CameraController,
  DEFAULT_DIST,
  LERP_SPEED,
  LOOK_TARGET_Y,
} from "./camera-controller";
import { WaterPlane } from "./water-plane";
import {
  PHYSICS_PARAMS,
  PHYSICS_STEPS,
  PLAYER_CAPSULE,
} from "./scene-defaults";
import { WebGPURenderer } from "three/webgpu";

declare module "@react-three/fiber" {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as any);

// ── Scene ──────────────────────────────────────────────────────────────────

interface GameWorldProps {
  rt: UseMetaverse;
  placeId: string;
}

function MyScene({ rt }: GameWorldProps) {
  const playerRef = useRef<THREE.Group>(null);
  const movingPlatformsRef = useRef<MovingPlatform[]>([]);
  const physicsStateRef = useRef<PlayerPhysicsState>({
    velocity: new THREE.Vector3(),
    isOnGround: false,
    offGroundTimer: 0,
    walkAnimation: 0,
  });
  const keysRef = useRef({
    fwd: false,
    bkd: false,
    lft: false,
    rgt: false,
    space: false,
  });
  const spacePressedRef = useRef(false);
  const thetaRef = useRef(0);
  const phiRef = useRef(0.5);
  const distRef = useRef(DEFAULT_DIST);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();

  // Keyboard input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, keyof typeof keysRef.current> = {
        KeyW: "fwd",
        KeyA: "lft",
        KeyS: "bkd",
        KeyD: "rgt",
        ArrowUp: "fwd",
        ArrowLeft: "lft",
        ArrowDown: "bkd",
        ArrowRight: "rgt",
        Space: "space",
      };
      const key = map[e.code];
      if (key) {
        keysRef.current[key] = e.type === "keydown";
        if (key === "space" && e.type === "keydown") {
          spacePressedRef.current = true;
        }
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // Broadcast position — throttled to ≤2 sends per 2s, only when moving
  useEffect(() => {
    const MIN_DELTA = 0.01;
    const MIN_INTERVAL = 1000;

    let lastSentPos = new Vector3();
    let lastSentRot = 0;
    let lastSentTime = 0;
    let raf: number;

    function tick() {
      const player = playerRef.current;
      if (!player) return;

      const pos = player.position;
      const euler = new Euler().setFromQuaternion(player.quaternion);
      const now = new Date().getTime();

      const moved =
        Math.abs(pos.x - lastSentPos.x) > MIN_DELTA ||
        Math.abs(pos.y - lastSentPos.y) > MIN_DELTA ||
        Math.abs(pos.z - lastSentPos.z) > MIN_DELTA ||
        Math.abs(euler.y - lastSentRot) > 0.001;

      if (moved && now - lastSentTime >= MIN_INTERVAL) {
        rt.sendMove(pos.x, pos.y, pos.z, euler.y);
        lastSentPos.copy(pos);
        lastSentRot = euler.y;
        lastSentTime = now;
      }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rt]);

  // Directional light follows player
  const lightOffset = useMemo(() => new THREE.Vector3(10, 35, 50), []);

  useFrame(() => {
    const player = playerRef.current;
    const light = lightRef.current;
    if (!player || !light) return;
    light.target.position.copy(player.position);
    light.position.copy(player.position).add(lightOffset);
  });

  // Physics + camera update (single useFrame — camera runs after physics)
  useFrame((_, delta) => {
    const player = playerRef.current;
    if (!player) return;

    const clampedDelta = Math.min(delta, 0.1);
    const stepDelta = clampedDelta / PHYSICS_STEPS;

    for (let i = 0; i < PHYSICS_STEPS; i++) {
      updatePlayerPhysics(
        stepDelta,
        player,
        PLAYER_CAPSULE,
        physicsStateRef.current,
        // staticBVH,
        movingPlatformsRef.current,
        keysRef.current,
        spacePressedRef.current,
        thetaRef.current,
        PHYSICS_PARAMS,
      );
    }

    spacePressedRef.current = false;

    if (player.position.y < -25) {
      resetPlayer(
        player,
        physicsStateRef.current,
        new THREE.Vector3(8, 10, 2.5),
      );
    }

    // Camera — after physics so it reads the final position this frame
    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;
    const theta = thetaRef.current;
    const phi = phiRef.current;
    const dist = distRef.current;

    const targetX = px + dist * Math.sin(phi) * Math.sin(theta);
    const targetY = py + dist * Math.cos(phi);
    const targetZ = pz + dist * Math.sin(phi) * Math.cos(theta);

    const camT = 1 - Math.exp(-LERP_SPEED * clampedDelta);
    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), camT);
    camera.lookAt(px, py + LOOK_TARGET_Y, pz);
  });

  // Platform registration helper
  const registerPlatform = (p: MovingPlatform) => {
    const arr = movingPlatformsRef.current;
    arr.push(p);
    return () => {
      const i = arr.indexOf(p);
      if (i !== -1) arr.splice(i, 1);
    };
  };

  return (
    <>
      <CameraController thetaRef={thetaRef} phiRef={phiRef} distRef={distRef} />

      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <Environment
          files={[`/assets/place/sky.hdr`]}
          environmentIntensity={0.75}
          background
        />

        <directionalLight
          ref={lightRef}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-1e-9 - 0.0005}
          shadow-normalBias={0.05}
          shadow-radius={3}
          shadow-camera-left={-100}
          shadow-camera-bottom={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
        />
      </Suspense>

      {/* GLTF environment (church model) */}
      <Suspense
        fallback={
          <KinematicPlatform
            position={[0, 0, 0]}
            motion={{ axis: "y", amplitude: 0, speed: 0 }}
            onReady={registerPlatform}
          >
            <mesh receiveShadow position={[0, -0.25, 0]}>
              <boxGeometry args={[50, 0.5, 50]} />
              <meshStandardNodeMaterial
                color="#ffffff"
                side={DoubleSide}
                roughness={1.0}
              />
            </mesh>
          </KinematicPlatform>
        }
      >
        <KinematicPlatform
          position={[0, 0, 0]}
          motion={{ axis: "y", amplitude: 0, speed: 0 }}
          onReady={registerPlatform}
        >
          <Gltf src="/assets/place/church.glb" receiveShadow castShadow />
          <WaterPlane />
        </KinematicPlatform>
      </Suspense>

      {/* Moving platforms */}
      <KinematicPlatform
        position={[0, 1.5, -8]}
        motion={{ axis: "y", amplitude: 2.0, speed: 1.2 }}
        onReady={registerPlatform}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.4, 3]} />
          <meshStandardNodeMaterial color="#e8a440" roughness={0.4} />
        </mesh>
      </KinematicPlatform>

      <KinematicPlatform
        position={[6, 2, -2]}
        motion={{ axis: "x", amplitude: 2, speed: 0.7 }}
        onReady={registerPlatform}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2, 0.3, 2]} />
          <meshStandardNodeMaterial color="#40a4e8" roughness={0.3} />
        </mesh>
      </KinematicPlatform>

      {/* Local player */}
      <group ref={playerRef} position={[0, 2, 0]} rotation={[0, 0, 0]}>
        <Suspense fallback={null}>
          <group rotation={[0, 0.5 * Math.PI, 0]}>
            <PlayerCharacter state={physicsStateRef.current} />
          </group>
        </Suspense>
      </group>

      {/* Remote players */}
      {rt.players.map((p) => (
        <RemoteCylinderAvatar key={p.id} player={p} />
      ))}
    </>
  );
}

export function GameWorld({ rt, placeId: _placeId }: GameWorldProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 200, position: [0, 6, 8] }}
        gl={async (props) => {
          const renderer = new WebGPURenderer(props as any);
          await renderer.init();
          return renderer;
        }}
      >
        <MyScene rt={rt} placeId={_placeId} />
      </Canvas>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-xs text-white/70 backdrop-blur">
        WASD to move &middot; Space to jump &middot; Drag mouse to orbit
        &middot; Scroll to zoom
      </div>
    </div>
  );
}
