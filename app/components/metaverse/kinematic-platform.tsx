import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshBVH, ObjectBVH } from "three-mesh-bvh";
import type { MovingPlatform } from "./physics";

interface KinematicPlatformProps {
  /** GLB model URL. If omitted, children are used as the platform geometry. */
  url?: string;
  scale?: number;
  position?: [number, number, number];
  /** Oscillation axis + amplitude + speed */
  motion?: {
    axis: "x" | "y" | "z";
    amplitude: number;
    speed: number; // radians per second
  };
  /** Register this platform with the physics loop.
   *  Return the unregister function from onReady to handle cleanup. */
  onReady?: (platform: MovingPlatform) => () => void;
  children?: ReactNode;
}

/**
 * A platform that loads a GLB model (or uses procedural children),
 * builds BVH for collision, and animates along a sine-wave axis.
 *
 * Refits the BVH each frame so shapecast stays accurate.
 * Exposes world-space velocity to the physics loop so the player
 * can ride the platform.
 */
export function KinematicPlatform({
  url,
  scale = 1,
  position = [0, 0, 0],
  motion = { axis: "y", amplitude: 1.5, speed: 0.8 },
  onReady,
  children,
}: KinematicPlatformProps) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const bvhRef = useRef<ObjectBVH | null>(null);
  const prevPos = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector3());
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const readyRef = useRef(false);
  const unregisterRef = useRef<(() => void) | null>(null);

  // Unregister on unmount
  useEffect(() => {
    return () => {
      unregisterRef.current?.();
    };
  }, []);

  // Build BVH from children once they're in the group (or after GLB load)
  useEffect(() => {
    const group = groupRef.current;
    if (!group || readyRef.current) return;
    if (url) return; // wait for GLB loader if URL is set
    if (!children) return;

    // Allow one frame for R3F to populate the group with child meshes
    const id = requestAnimationFrame(() => {
      if (!groupRef.current) return;
      buildBVH(groupRef.current);
    });
    return () => cancelAnimationFrame(id);
  }, [children, url]);

  // Load GLB and build BVH
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    new GLTFLoader().load(url, (res) => {
      if (cancelled) return;

      const gltfScene = res.scene;
      gltfScene.scale.setScalar(scale);

      gltfScene.traverse((c) => {
        c.castShadow = true;
        c.receiveShadow = true;
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh && !mesh.geometry.boundsTree) {
          mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
        }
      });

      gltfScene.updateMatrixWorld(true);

      const group = groupRef.current;
      if (!group) return;
      group.add(gltfScene);

      buildBVH(group);
    });

    return () => {
      cancelled = true;
    };
  }, [url, scale]);

  function buildBVH(group: THREE.Group) {
    group.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (mesh.isMesh && !mesh.geometry.boundsTree) {
        mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
      }
    });
    group.updateMatrixWorld(true);

    const bvh = new ObjectBVH(group, { maxLeafTris: 1 });
    bvhRef.current = bvh;
    prevPos.current.copy(group.position);

    onReady?.({
      group,
      bvh,
      velocity: velocity.current,
    });
    readyRef.current = true;
  }

  // Animate and refit BVH
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !readyRef.current) return;

    const phase = phaseRef.current;
    const axis = motion.axis;
    const offset = Math.sin(phase) * motion.amplitude;

    if (axis === "x") group.position.x = position[0] + offset;
    else if (axis === "y") group.position.y = position[1] + offset;
    else group.position.z = position[2] + offset;

    // Run on axis-agnostic position sync for non-moving axes
    if (axis !== "x") group.position.x = position[0];
    if (axis !== "y") group.position.y = position[1];
    if (axis !== "z") group.position.z = position[2];

    // Compute frame velocity for player-on-platform carry
    velocity.current
      .copy(group.position)
      .sub(prevPos.current)
      .divideScalar(Math.max(delta, 0.001));
    prevPos.current.copy(group.position);

    phaseRef.current += motion.speed * delta;

    // Refit BVH so shapecast sees the updated position
    group.updateMatrixWorld();
    bvhRef.current?.refit();
  });

  return <group ref={groupRef}>{children}</group>;
}
