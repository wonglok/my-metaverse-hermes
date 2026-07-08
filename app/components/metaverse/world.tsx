import { useRef, useEffect, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Sky, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { UseMetaverse } from "@/hooks/use-metaverse";
import { PlayerCharacter } from "./player-character";
import { RemoteCylinderAvatar } from "./cylinder-avatar";
import { ProceduralColliders, type PlatformDef } from "./gltf-environment";
import { KinematicPlatform } from "./kinematic-platform";
import {
  updatePlayerPhysics,
  resetPlayer,
  type PlayerCapsule,
  type PlayerPhysicsState,
  type BVHContext,
  type MovingPlatform,
} from "./physics";

// ── Default platforms (matching previous world layout) ─────────────────────

const DEFAULT_PLATFORMS: PlatformDef[] = [
  // Ground-level platforms
  { position: [3, 0.5, -3], size: [2, 1, 2] },
  { position: [5, 0.3, 2], size: [2, 0.6, 4] },
  { position: [-6, 0.5, 1], size: [2, 1, 2] },

  // Elevated platforms (floating, no ground connection)
  { position: [-4, 2.5, -3], size: [2, 0.4, 2] },
  { position: [0, 3.5, -5], size: [2.5, 0.3, 2.5] },
  { position: [4, 4.5, -4], size: [2, 0.3, 2] },

  // Staircase to get up to floating platforms
  { position: [-4, 0.75, 2], size: [2, 0.5, 1.5] },
  { position: [-4, 1.5, 1], size: [2, 0.5, 1.5] },
  { position: [-4, 2.25, 0], size: [2, 0.5, 1.5] },

  // Wide elevated walkway
  { position: [6, 2.0, -6], size: [5, 0.3, 1.5] },
  { position: [8, 2.8, -6], size: [3, 0.3, 1.5] },
];

// ── Physics params ─────────────────────────────────────────────────────────

const PHYSICS_PARAMS = { gravity: -80, playerSpeed: 10 };
const PHYSICS_STEPS = 5;

// ── Player capsule definition ──────────────────────────────────────────────

const PLAYER_CAPSULE: PlayerCapsule = {
  radius: 0.75,
  segment: new THREE.Line3(
    new THREE.Vector3(0, 0.75, 0),
    new THREE.Vector3(0, 1.0, 0),
  ),
};

// ── Third-person camera ────────────────────────────────────────────────────

const MIN_PHI = 0.15;
const MAX_PHI = Math.PI / 2 - 0.1;
const MIN_DIST = 3;
const MAX_DIST = 20;
const DEFAULT_DIST = 8;
const LERP_SPEED = 8;
const LOOK_TARGET_Y = 1.0;

interface CameraControllerProps {
  targetRef: React.RefObject<THREE.Group | null>;
  thetaRef: React.RefObject<number>;
}

function CameraController({ targetRef, thetaRef }: CameraControllerProps) {
  const { camera, gl } = useThree();

  const phiRef = useRef(0.5);
  const distRef = useRef(DEFAULT_DIST);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = gl.domElement;

    function onDown(e: MouseEvent) {
      dragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
    function onUp() {
      dragging.current = false;
    }
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      thetaRef.current -= dx * 0.005;
      phiRef.current = Math.min(
        MAX_PHI,
        Math.max(MIN_PHI, phiRef.current - dy * 0.005),
      );
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
    function onWheel(e: WheelEvent) {
      distRef.current = Math.min(
        MAX_DIST,
        Math.max(MIN_DIST, distRef.current + e.deltaY * 0.01),
      );
    }

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const group = targetRef.current;
    if (!group) return;

    const px = group.position.x;
    const py = group.position.y;
    const pz = group.position.z;

    const theta = thetaRef.current;
    const phi = phiRef.current;
    const dist = distRef.current;

    const targetX = px + dist * Math.sin(phi) * Math.sin(theta);
    const targetY = py + dist * Math.cos(phi);
    const targetZ = pz + dist * Math.sin(phi) * Math.cos(theta);

    const t = 1 - Math.exp(-LERP_SPEED * delta);
    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), t);
    camera.lookAt(px, py + LOOK_TARGET_Y, pz);
  });

  return null;
}

// ── Scene ──────────────────────────────────────────────────────────────────

interface GameWorldProps {
  rt: UseMetaverse;
  placeId: string;
}

function MyScene({ rt }: GameWorldProps) {
  const playerRef = useRef<THREE.Group>(null);
  const staticBVHRef = useRef<BVHContext | null>(null);
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
    const MIN_DELTA = 0.01; // ignore sub-centimeter drift
    const MIN_INTERVAL = 1000; // ms between sends (2 per 2s)

    let lastSentPos = new THREE.Vector3();
    let lastSentRot = 0;
    let lastSentTime = 0;
    let raf: number;

    function tick() {
      const player = playerRef.current;
      if (!player) return;

      const pos = player.position;
      const euler = new THREE.Euler().setFromQuaternion(player.quaternion);
      const now = performance.now();

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

  // Physics + walk animation
  useFrame((_, delta) => {
    const player = playerRef.current;
    const staticBVH = staticBVHRef.current;
    if (!player || !staticBVH) return;

    const clampedDelta = Math.min(delta, 0.1);
    const stepDelta = clampedDelta / PHYSICS_STEPS;

    for (let i = 0; i < PHYSICS_STEPS; i++) {
      updatePlayerPhysics(
        stepDelta,
        player,
        PLAYER_CAPSULE,
        physicsStateRef.current,
        staticBVH,
        movingPlatformsRef.current,
        keysRef.current,
        spacePressedRef.current,
        thetaRef.current,
        PHYSICS_PARAMS,
      );
    }

    spacePressedRef.current = false;

    // Reset if fallen too far
    if (player.position.y < -5) {
      resetPlayer(
        player,
        physicsStateRef.current,
        new THREE.Vector3(8, 10, 2.5),
      );
    }
  });

  return (
    <>
      <CameraController targetRef={playerRef} thetaRef={thetaRef} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Sky sunPosition={[100, 50, 100]} />

      <Suspense fallback={null}>
        <Environment preset="park" />
      </Suspense>

      <ProceduralColliders
        platforms={DEFAULT_PLATFORMS}
        onBVHReady={(bvh, root) => {
          staticBVHRef.current = { bvh, root };
        }}
      />

      {/* Moving platforms */}
      <KinematicPlatform
        position={[0, 1.5, -8]}
        motion={{ axis: "y", amplitude: 1.5, speed: 1.2 }}
        onReady={(p) => {
          const arr = movingPlatformsRef.current;
          arr.push(p);
          return () => {
            const i = arr.indexOf(p);
            if (i !== -1) arr.splice(i, 1);
          };
        }}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.4, 3]} />
          <meshStandardMaterial color="#e8a440" roughness={0.4} />
        </mesh>
      </KinematicPlatform>

      <KinematicPlatform
        position={[6, 2, -2]}
        motion={{ axis: "x", amplitude: 2, speed: 0.7 }}
        onReady={(p) => {
          const arr = movingPlatformsRef.current;
          arr.push(p);
          return () => {
            const i = arr.indexOf(p);
            if (i !== -1) arr.splice(i, 1);
          };
        }}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2, 0.3, 2]} />
          <meshStandardMaterial color="#40a4e8" roughness={0.3} />
        </mesh>
      </KinematicPlatform>

      {/* Local player */}
      <group
        ref={playerRef}
        position={[0, 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <PlayerCharacter
          walkAnimation={0}
          color={rt.self?.color ?? "#ff637e"}
        />
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
        gl={{ antialias: true }}
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
