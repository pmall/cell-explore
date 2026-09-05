import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { CELL_RADIUS } from '../data/layout'

const FLIGHT_SECONDS = 1.7
const IDLE_BEFORE_DRIFT = 6

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)

  const goal = useStore((s) => s.cameraGoal)
  const tickTour = useStore((s) => s.tickTour)

  // Flight state lives in refs — it changes every frame and must not re-render.
  const flight = useRef({
    active: false,
    startedAt: 0,
    fromPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  })
  const lastNonce = useRef(-1)
  const idleFor = useRef(0)

  useEffect(() => {
    const bump = () => {
      idleFor.current = 0
    }
    window.addEventListener('pointerdown', bump)
    window.addEventListener('wheel', bump, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('wheel', bump)
    }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20)
    const controls = controlsRef.current
    if (!controls) return

    tickTour(delta)

    // A new camera goal arrived — plot a flight from wherever we are now.
    if (goal.nonce !== lastNonce.current) {
      lastNonce.current = goal.nonce
      const f = flight.current
      f.fromPos.copy(camera.position)
      f.fromTarget.copy(controls.target)
      f.toTarget.copy(goal.target)

      // Keep the viewer's current viewing direction so the flight feels like a
      // move rather than a cut, but nudge it outward if it would end up buried.
      const dir = camera.position.clone().sub(controls.target)
      if (dir.lengthSq() < 1e-6) dir.set(0.6, 0.35, 1)
      dir.normalize()
      const fromCentre = goal.target.clone().normalize()
      if (fromCentre.lengthSq() > 0.01 && goal.distance < CELL_RADIUS) {
        // Close-ups look better viewed from slightly outside the structure.
        dir.lerp(fromCentre, 0.35).normalize()
      }
      dir.y += 0.12
      dir.normalize()

      f.toPos.copy(goal.target).addScaledVector(dir, goal.distance)
      // Timed against the wall clock, not accumulated frame deltas: on a slow
      // machine a delta-driven flight takes many seconds of real time to cover
      // its 1.7 "seconds" of animation, which reads as the camera being stuck.
      f.startedAt = performance.now()
      f.active = true
      idleFor.current = 0
    }

    const f = flight.current
    if (f.active) {
      const t = Math.min(1, (performance.now() - f.startedAt) / (FLIGHT_SECONDS * 1000))
      const e = easeInOutCubic(t)
      camera.position.lerpVectors(f.fromPos, f.toPos, e)
      controls.target.lerpVectors(f.fromTarget, f.toTarget, e)
      controls.update()
      if (t >= 1) f.active = false
      return
    }

    // Idle drift: a very slow orbit so the scene never feels like a still image.
    idleFor.current += delta
    controls.autoRotate = idleFor.current > IDLE_BEFORE_DRIFT
    controls.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      panSpeed={0.6}
      autoRotateSpeed={0.22}
      minDistance={0.8}
      maxDistance={70}
    />
  )
}
