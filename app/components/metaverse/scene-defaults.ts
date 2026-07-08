import * as THREE from "three";
import type { PlayerCapsule, PhysicsParams } from "./physics";
import type { PlatformDef } from "./gltf-environment";

export const DEFAULT_PLATFORMS: PlatformDef[] = [
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

export const PHYSICS_PARAMS: PhysicsParams = { gravity: -80, playerSpeed: 10 };
export const PHYSICS_STEPS = 5;

export const PLAYER_CAPSULE: PlayerCapsule = {
  radius: 0.75,
  segment: new THREE.Line3(
    new THREE.Vector3(0, 0.75, 0),
    new THREE.Vector3(0, 1.0, 0),
  ),
};
