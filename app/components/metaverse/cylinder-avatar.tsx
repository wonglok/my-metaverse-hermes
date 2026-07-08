import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CylinderAvatarProps {
  color: string
  position?: [number, number, number]
  rotation?: number
  isLocal?: boolean
  name?: string
}

const LERP_FACTOR = 0.15

export function CylinderAvatar({ color, position = [0, 0, 0], rotation = 0, isLocal = false, name }: CylinderAvatarProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Mesh>(null)
  const headRef = useRef<THREE.Mesh>(null)

  // Smooth position/rotation interpolation for remote players
  const targetPos = useRef(new THREE.Vector3(...position))
  const currentPos = useRef(new THREE.Vector3(...position))
  const targetRot = useRef(rotation)
  const currentRot = useRef(rotation)

  useEffect(() => {
    targetPos.current.set(...position)
    targetRot.current = rotation
  }, [position, rotation])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const t = 1 - Math.exp(-LERP_FACTOR * delta * 60)
    currentPos.current.lerp(targetPos.current, t)
    currentRot.current = THREE.MathUtils.lerp(currentRot.current, targetRot.current, t)
    groupRef.current.position.copy(currentPos.current)
    groupRef.current.rotation.y = currentRot.current
  })

  return (
    <group ref={groupRef}>
      {/* Body - feet at y=0 (group origin). height=1.2, center at 0.6 */}
      <mesh ref={bodyRef} castShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 1.2, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>

      {/* Head - sits on top of body (body top = 1.2), head height=0.45, center at 1.425 */}
      <mesh ref={headRef} castShadow position={[0, 1.425, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.45, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.08, 1.5, 0.22]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[-0.08, 1.5, 0.22]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Direction indicator */}
      <mesh position={[0, 0.8, 0.38]}>
        <boxGeometry args={[0.12, 0.06, 0.08]} />
        <meshStandardMaterial color={isLocal ? '#ffffff' : '#000000'} roughness={0.3} />
      </mesh>

      {/* Name label */}
      {name && (
        <sprite position={[0, 1.85, 0]} scale={[1.5, 0.4, 1]}>
          <spriteMaterial color={color} transparent opacity={0.9} />
        </sprite>
      )}
    </group>
  )
}

/** Static cylinder avatar without physics: used for remote players. */
export function RemoteCylinderAvatar({ player }: { player: { x: number; y: number; z: number; rotation: number; color: string; name: string } }) {
  return (
    <CylinderAvatar
      color={player.color}
      position={[player.x, player.y, player.z]}
      rotation={player.rotation}
      name={player.name}
    />
  )
}
