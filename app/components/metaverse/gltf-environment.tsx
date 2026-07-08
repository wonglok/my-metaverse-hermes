import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshBVH, ObjectBVH } from "three-mesh-bvh";

interface GltfEnvironmentProps {
  url?: string;
  scale?: number;
  onBVHReady?: (bvh: ObjectBVH, scene: THREE.Group) => void;
}

/**
 * Loads a GLTF environment and builds MeshBVH per mesh + ObjectBVH for shapecast.
 * Falls back to procedural ground + platforms if no URL provided.
 */
export function GltfEnvironment({
  url,
  scale = 1.75,
  onBVHReady,
}: GltfEnvironmentProps) {
  const { scene } = useThree();
  const gltfSceneRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;

    new GLTFLoader().load(url, (res) => {
      if (cancelled) return;

      const gltfScene = res.scene;
      gltfScene.scale.setScalar(scale);
      gltfScene.updateMatrixWorld(true);

      gltfScene.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh) {
          // Reset transmission on physical materials
          const mat = mesh.material as THREE.MeshPhysicalMaterial;
          if (mat.isMeshPhysicalMaterial) {
            mat.transmission = 0;
          }
        }

        c.castShadow = true;
        c.receiveShadow = true;

        if (mesh.isMesh && !mesh.geometry.boundsTree) {
          mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
        }
      });

      gltfScene.updateMatrixWorld(true);
      scene.add(gltfScene);
      gltfSceneRef.current = gltfScene;

      const sceneBVH = new ObjectBVH(gltfScene, { maxLeafTris: 1 });
      onBVHReady?.(sceneBVH, gltfScene);
    });

    return () => {
      cancelled = true;
      if (gltfSceneRef.current) {
        scene.remove(gltfSceneRef.current);
        gltfSceneRef.current = null;
      }
    };
  }, [url, scale]);

  return null;
}

// ── Procedural ground + platforms with BVH (fallback when no GLTF URL) ────

export interface PlatformDef {
  position: [number, number, number];
  size: [number, number, number];
}

interface ProceduralCollidersProps {
  platforms?: PlatformDef[];
  onBVHReady?: (bvh: ObjectBVH, group: THREE.Group) => void;
}

export function ProceduralColliders({
  platforms = [],
  onBVHReady,
}: ProceduralCollidersProps) {
  const groupRef = useRef<THREE.Group>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (readyRef.current || !groupRef.current) return;
    readyRef.current = true;

    const group = groupRef.current;
    group.updateMatrixWorld(true);

    group.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
      }
    });

    group.updateMatrixWorld(true);
    const sceneBVH = new ObjectBVH(group, { maxLeafTris: 1 });
    onBVHReady?.(sceneBVH, group);
  }, []);

  return (
    <group ref={groupRef}>
      {/* Ground */}
      <mesh receiveShadow position={[0, -0.25, 0]}>
        <boxGeometry args={[50, 0.5, 50]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.8} />
      </mesh>

      {/* Platforms */}
      {platforms.map((p, i) => (
        <mesh
          key={i}
          position={p.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={p.size} />
          <meshStandardMaterial color="#555" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
