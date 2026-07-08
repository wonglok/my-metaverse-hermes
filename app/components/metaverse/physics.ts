import * as THREE from "three";
import { ObjectBVH } from "three-mesh-bvh";

// ── Reusable vectors/matrices (module-level, same pattern as vanilla) ──────
const _upVector = new THREE.Vector3(0, 1, 0);
const _tempVector = new THREE.Vector3();
const _tempVector2 = new THREE.Vector3();
const _sceneLocalBox = new THREE.Box3();
const _objectLocalBox = new THREE.Box3();
const _invMat = new THREE.Matrix4();
const _worldSegment = new THREE.Line3();
const _localSegment = new THREE.Line3();
const _sphere = new THREE.Sphere();

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlayerCapsule {
  radius: number;
  segment: THREE.Line3;
}

export interface PhysicsParams {
  gravity: number;
  playerSpeed: number;
}

export interface PlayerPhysicsState {
  velocity: THREE.Vector3;
  isOnGround: boolean;
  offGroundTimer: number;
  walkAnimation: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const OFF_GROUND_TIME = 0.05;
export const WALK_CYCLE_TIME = 2 * Math.PI;
const JUMP_VELOCITY = 28;

// ── BVH context (root group + bvh) ─────────────────────────────────────────

export interface BVHContext {
  bvh: ObjectBVH;
  root: THREE.Group;
}

/** A platform that moves — exposes velocity so the player can ride it. */
export interface MovingPlatform {
  group: THREE.Group;
  bvh: ObjectBVH;
  velocity: THREE.Vector3; // world-space velocity (updated each frame)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isTransparent(obj: THREE.Object3D): boolean {
  const mesh = obj as THREE.Mesh;
  if (!mesh.isMesh) return false;
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  return materials.some(
    (m) =>
      (m as THREE.Material & { transparent?: boolean }).transparent === true,
  );
}

/** Run the core shapecast loop against a single BVH context. */
function shapecastBVH(bvhCtx: BVHContext, capsule: PlayerCapsule): void {
  bvhCtx.root.updateMatrixWorld();
  _invMat.copy(bvhCtx.root.matrixWorld).invert();

  _sceneLocalBox.makeEmpty();
  _sceneLocalBox.expandByPoint(_worldSegment.start);
  _sceneLocalBox.expandByPoint(_worldSegment.end);
  _sceneLocalBox.min.addScalar(-capsule.radius);
  _sceneLocalBox.max.addScalar(capsule.radius);
  _sceneLocalBox.applyMatrix4(_invMat);

  bvhCtx.bvh.shapecast({
    intersectsBounds: (box) => box.intersectsBox(_sceneLocalBox),

    intersectsObject: (object) => {
      if (!object.visible) return;
      if (!(object as THREE.Mesh).isMesh) return;
      if (isTransparent(object)) return;

      _invMat.copy(object.matrixWorld).invert();

      _objectLocalBox.makeEmpty();
      _objectLocalBox.expandByPoint(_worldSegment.start);
      _objectLocalBox.expandByPoint(_worldSegment.end);
      _objectLocalBox.min.addScalar(-capsule.radius);
      _objectLocalBox.max.addScalar(capsule.radius);
      _objectLocalBox.applyMatrix4(_invMat);

      _localSegment.copy(_worldSegment).applyMatrix4(_invMat);
      _sphere.radius = capsule.radius;
      _sphere.applyMatrix4(_invMat);
      const localRadius = _sphere.radius;

      const mesh = object as THREE.Mesh;
      if (!mesh.geometry.boundsTree) return;

      (mesh.geometry.boundsTree as any).shapecast({
        intersectsBounds: (box: THREE.Box3) =>
          box.intersectsBox(_objectLocalBox),

        intersectsTriangle: (tri: THREE.Triangle) => {
          const triPoint = _tempVector;
          const capsulePoint = _tempVector2;

          const distance = (tri as any).closestPointToSegment(
            _localSegment,
            triPoint,
            capsulePoint,
          );
          if (distance < localRadius) {
            const depth = localRadius - distance;
            const direction = capsulePoint.sub(triPoint).normalize();
            _localSegment.start.addScaledVector(direction, depth);
            _localSegment.end.addScaledVector(direction, depth);
          }
        },
      });

      _worldSegment.copy(_localSegment).applyMatrix4(object.matrixWorld);
    },
  });
}

// ── Physics step ───────────────────────────────────────────────────────────

export function updatePlayerPhysics(
  delta: number,
  player: THREE.Group,
  capsule: PlayerCapsule,
  state: PlayerPhysicsState,
  movingPlatforms: MovingPlatform[],
  keys: { fwd: boolean; bkd: boolean; lft: boolean; rgt: boolean },
  spacePressed: boolean,
  walkAngle: number,
  params: PhysicsParams,
): void {
  player.updateMatrixWorld();

  // Get capsule in world space
  _worldSegment.copy(capsule.segment).applyMatrix4(player.matrixWorld);

  // Apply gravity
  state.velocity.y += delta * params.gravity;
  _worldSegment.start.addScaledVector(state.velocity, delta);
  _worldSegment.end.addScaledVector(state.velocity, delta);

  // Calculate walk direction
  const walkDirection = new THREE.Vector3();
  const directions: { key: boolean; vec: [number, number, number] }[] = [
    { key: keys.fwd, vec: [0, 0, -1] },
    { key: keys.bkd, vec: [0, 0, 1] },
    { key: keys.lft, vec: [-1, 0, 0] },
    { key: keys.rgt, vec: [1, 0, 0] },
  ];

  for (const { key, vec } of directions) {
    if (key) {
      _tempVector.set(...vec).applyAxisAngle(_upVector, walkAngle);
      walkDirection.addScaledVector(_tempVector, params.playerSpeed * delta);
    }
  }

  // Update walk animation
  // const animationStep = delta * 25;
  state.walkAnimation = 1;

  if (state.offGroundTimer < 0) {
    state.walkAnimation = 0;
  }

  // Apply walk direction
  if (walkDirection.length() > 0) {
    _worldSegment.start.add(walkDirection);
    _worldSegment.end.add(walkDirection);

    const right = new THREE.Vector3(1, 0, 0);
    const dirAngle = right.angleTo(walkDirection.normalize());
    right.cross(walkDirection);

    const quat = new THREE.Quaternion().setFromAxisAngle(
      _upVector,
      Math.sign(right.y) * dirAngle,
    );
    player.quaternion.slerp(quat, 1 - 2 ** (-delta / 0.05));
  } else {
    state.walkAnimation = 0;
  }

  // Jump
  if (spacePressed && (state.isOnGround || state.offGroundTimer > 0)) {
    state.velocity.y = JUMP_VELOCITY;
    state.isOnGround = false;
    state.offGroundTimer = 0;
  }

  const segmentStart = _worldSegment.start.clone();

  // // Shapecast against static environment
  // shapecastBVH(staticBVH, capsule);

  // Shapecast against each moving platform
  for (const mp of movingPlatforms) {
    shapecastBVH({ bvh: mp.bvh, root: mp.group }, capsule);
  }

  // Update player position
  const deltaVector = _tempVector2;
  deltaVector.copy(capsule.segment.start).applyMatrix4(player.matrixWorld);
  deltaVector.subVectors(_worldSegment.start, deltaVector);
  player.position.add(deltaVector);

  // Check if player is on ground
  deltaVector.copy(segmentStart).subVectors(_worldSegment.start, deltaVector);
  const touchingGround =
    deltaVector.y > Math.abs(delta * state.velocity.y * 0.25);

  if (touchingGround) {
    state.offGroundTimer = OFF_GROUND_TIME;
    state.isOnGround = true;

    // Carry the player with any moving platform they're standing on.
    // Check each platform: if the player capsule overlaps the platform group
    // AABB and the player was pushed upward, apply the platform's velocity.
    for (const mp of movingPlatforms) {
      const platBox = new THREE.Box3().setFromObject(mp.group);
      platBox.expandByScalar(0.1); // small tolerance

      const playerBottom = new THREE.Vector3(
        player.position.x,
        player.position.y, // capsule bottom is near player origin
        player.position.z,
      );

      if (platBox.containsPoint(playerBottom)) {
        player.position.addScaledVector(mp.velocity, delta);
      }
    }

    state.velocity.set(0, 0, 0);
  } else {
    state.offGroundTimer -= delta;
    state.isOnGround = false;
    state.velocity.addScaledVector(
      deltaVector,
      -deltaVector.dot(state.velocity),
    );
  }
}

export function resetPlayer(
  player: THREE.Group,
  state: PlayerPhysicsState,
  position: THREE.Vector3,
): void {
  state.velocity.set(0, 0, 0);
  player.position.copy(position);
}
