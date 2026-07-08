import { useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky, Environment } from '@react-three/drei'
import BVHEcctrl, { type BVHEcctrlApi, StaticCollider } from 'bvhecctrl'
import type { UseMetaverse } from '@/hooks/use-metaverse'
import { CylinderAvatar, RemoteCylinderAvatar } from './cylinder-avatar'
import * as THREE from 'three'

function Ground() {
  return (
    <StaticCollider>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.8} />
      </mesh>
    </StaticCollider>
  )
}

function Platform({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <StaticCollider>
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#555" roughness={0.6} />
      </mesh>
    </StaticCollider>
  )
}

interface GameWorldProps {
  rt: UseMetaverse
  placeId: string
}

function Scene({ rt, placeId }: GameWorldProps) {
  const ecctrlRef = useRef<BVHEcctrlApi>(null)
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false, space: false })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, keyof typeof keysRef.current> = {
        KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
        ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd',
        ShiftLeft: 'shift', Space: 'space',
      }
      const key = map[e.code]
      if (key) {
        keysRef.current[key] = e.type === 'keydown'
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  // Drive the BVHEcctrl movement from keyboard input
  useEffect(() => {
    let raf: number
    function tick() {
      const k = keysRef.current
      const api = ecctrlRef.current
      if (api) {
        api.setMovement({
          forward: k.w,
          backward: k.s,
          leftward: k.a,
          rightward: k.d,
          run: k.shift,
          jump: k.space,
        })

        // Broadcast position
        const group = api.group
        if (group) {
          const pos = group.position
          const euler = new THREE.Euler().setFromQuaternion(group.quaternion)
          rt.sendMove(pos.x, pos.y, pos.z, euler.y)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rt])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Sky sunPosition={[100, 50, 100]} />
      <Environment preset="park" />

      <Ground />

      {/* Some platforms to jump on */}
      <Platform position={[3, 0.5, -3]} size={[2, 1, 2]} />
      <Platform position={[-4, 0.75, -2]} size={[2, 1.5, 2]} />
      <Platform position={[0, 0.5, -6]} size={[4, 1, 1.5]} />
      <Platform position={[5, 0.3, 2]} size={[1.5, 0.6, 4]} />
      <Platform position={[-3, 1, 3]} size={[3, 2, 3]} />

      {/* Local player with physics */}
      <BVHEcctrl
        ref={ecctrlRef}
        position={[0, 2, 0]}
        maxWalkSpeed={4}
        maxRunSpeed={7}
        jumpVel={6}
        floatHeight={1.0}
        colliderCapsuleArgs={[0.35, 1.0, 8, 16]}
      >
        <CylinderAvatar
          color={rt.self?.color ?? '#ff637e'}
          isLocal
          name={rt.self?.name}
        />
      </BVHEcctrl>

      {/* Remote players */}
      {rt.players.map((p) => (
        <RemoteCylinderAvatar key={p.id} player={p} />
      ))}
    </>
  )
}

export function GameWorld({ rt, placeId }: GameWorldProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 200, position: [0, 4, 8] }}
        gl={{ antialias: true }}
      >
        <Scene rt={rt} placeId={placeId} />
      </Canvas>

      {/* Controls hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-xs text-white/70 backdrop-blur">
        WASD or Arrow keys to move &middot; Shift to run &middot; Space to jump &middot; Mouse to look around
      </div>
    </div>
  )
}
