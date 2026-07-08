import { useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
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

// ── Third-person camera that follows the ecctrl avatar ────────────────────────

const MIN_PHI = 0.15
const MAX_PHI = Math.PI / 2 - 0.1
const MIN_DIST = 3
const MAX_DIST = 20
const DEFAULT_DIST = 8
const LERP_SPEED = 8
const LOOK_TARGET_Y = 1.5 // aim at upper body

interface CameraControllerProps {
  targetRef: React.RefObject<BVHEcctrlApi | null>
}

function CameraController({ targetRef }: CameraControllerProps) {
  const { camera, gl } = useThree()

  const thetaRef = useRef(0) // horizontal orbit angle (radians)
  const phiRef = useRef(0.5) // vertical orbit angle
  const distRef = useRef(DEFAULT_DIST)
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // Mouse orbit + scroll zoom
  useEffect(() => {
    const canvas = gl.domElement

    function onDown(e: MouseEvent) {
      dragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    function onUp() {
      dragging.current = false
    }
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      thetaRef.current -= dx * 0.005
      phiRef.current = Math.min(MAX_PHI, Math.max(MIN_PHI, phiRef.current - dy * 0.005))
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    function onWheel(e: WheelEvent) {
      distRef.current = Math.min(MAX_DIST, Math.max(MIN_DIST, distRef.current + e.deltaY * 0.01))
    }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    canvas.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_, delta) => {
    const group = targetRef.current?.group
    if (!group) return

    const px = group.position.x
    const py = group.position.y
    const pz = group.position.z

    const theta = thetaRef.current
    const phi = phiRef.current
    const dist = distRef.current

    // Spherical → Cartesian relative to the player
    const targetX = px + dist * Math.sin(phi) * Math.sin(theta)
    const targetY = py + dist * Math.cos(phi)
    const targetZ = pz + dist * Math.sin(phi) * Math.cos(theta)

    const t = 1 - Math.exp(-LERP_SPEED * delta)
    camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), t)
    camera.lookAt(px, py + LOOK_TARGET_Y, pz)
  })

  return null
}

// ── Scene ─────────────────────────────────────────────────────────────────────

interface GameWorldProps {
  rt: UseMetaverse
  placeId: string
}

function Scene({ rt }: GameWorldProps) {
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

  // Drive BVHEcctrl movement from keyboard + broadcast position
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
      <CameraController targetRef={ecctrlRef} />

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

      <Platform position={[3, 0.5, -3]} size={[2, 1, 2]} />
      <Platform position={[-4, 0.75, -2]} size={[2, 1.5, 2]} />
      <Platform position={[0, 0.5, -6]} size={[4, 1, 1.5]} />
      <Platform position={[5, 0.3, 2]} size={[1.5, 0.6, 4]} />
      <Platform position={[-3, 1, 3]} size={[3, 2, 3]} />

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
        camera={{ fov: 60, near: 0.1, far: 200, position: [0, 6, 8] }}
        gl={{ antialias: true }}
      >
        <Scene rt={rt} placeId={placeId} />
      </Canvas>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-xs text-white/70 backdrop-blur">
        WASD to move &middot; Shift to run &middot; Space to jump &middot; Drag mouse to orbit &middot; Scroll to zoom
      </div>
    </div>
  )
}
