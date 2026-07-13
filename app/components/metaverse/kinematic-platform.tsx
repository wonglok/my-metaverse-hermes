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
  // scale = 1,
  position = [0, 0, 0],
  motion = { axis: "x", amplitude: 0, speed: 0 },
  onReady,
  children,
  scale = 1,
}: KinematicPlatformProps) {
  // const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const bvhRef = useRef<ObjectBVH | null>(null);
  const velocity = useRef(new THREE.Vector3());
  const unregisterRef = useRef<(() => void) | null>(null);

  // Build BVH from children once they're in the group (or after GLB load)
  useEffect(() => {
    let clean = () => {};

    let tt = setInterval(() => {
      if (groupRef.current) {
        clearInterval(tt);
        const group = groupRef.current;
        if (!group) return;
        // if (url) return; // wait for GLB loader if URL is set
        if (!children) return;

        // Allow one frame for R3F to populate the group with child meshes
        const id = setTimeout(() => {
          if (!groupRef.current) return;
          buildBVH(groupRef.current);
        }, 5);

        clean();
        clean = () => {
          unregisterRef.current?.();
          clearTimeout(id);
        };
      }
    }, 10);

    return () => {
      clearInterval(tt);
      clean();
    };
  }, [children, url]);

  // // Load GLB and build BVH
  // useEffect(() => {
  //   if (!url) return;
  //   let cancelled = false;

  //   new GLTFLoader().load(url, (res) => {
  //     if (cancelled) return;

  //     const gltfScene = res.scene;
  //     gltfScene.scale.setScalar(scale);

  //     gltfScene.traverse((c) => {
  //       c.castShadow = true;
  //       c.receiveShadow = true;
  //       const mesh = c as THREE.Mesh;
  //       if (mesh.isMesh && !mesh.geometry.boundsTree) {
  //         mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
  //       }
  //     });

  //     gltfScene.updateMatrixWorld(true);

  //     const group = groupRef.current;
  //     if (!group) return;
  //     group.add(gltfScene);

  //     buildBVH(group);
  //   });

  //   return () => {
  //     cancelled = true;
  //   };
  // }, [url, scale]);

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

    const platform: MovingPlatform = {
      group,
      bvh,
      velocity: velocity.current,
    };
    unregisterRef.current = onReady?.(platform) ?? null;
  }

  // Animate using wall-clock time so all peers stay in sync without network
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const t = Date.now() / 1000; // seconds since epoch
    const axis = motion.axis;
    const { amplitude, speed } = motion;
    const phase = t * speed;

    // Position: base + amplitude * sin(time * speed)
    const offset = Math.sin(phase) * amplitude;
    const velValue = Math.cos(phase) * amplitude * speed; // analytical derivative

    if (axis === "x") {
      group.position.x = position[0] + offset;
      velocity.current.set(velValue, 0, 0);
    } else if (axis === "y") {
      group.position.y = position[1] + offset;
      velocity.current.set(0, velValue, 0);
    } else {
      group.position.z = position[2] + offset;
      velocity.current.set(0, 0, velValue);
    }

    // Sync non-moving axes to base position
    if (axis !== "x") group.position.x = position[0];
    if (axis !== "y") group.position.y = position[1];
    if (axis !== "z") group.position.z = position[2];

    // Refit BVH so shapecast sees the updated position
    group.updateMatrixWorld();
    bvhRef.current?.refit();
  });

  return <group ref={groupRef}>{children}</group>;
}
