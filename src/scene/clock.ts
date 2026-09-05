import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store'

/**
 * A single clock for every biological process in the scene, scaled by the
 * viewer's speed control. Using the raw render clock instead would mean the
 * animations jump whenever the speed changes, and would make it impossible to
 * pause the biology while still letting the camera move.
 */
const state = { t: 0 }

export function cellTime() {
  return state.t
}

export function CellClockDriver() {
  useFrame((_, delta) => {
    state.t += Math.min(delta, 1 / 20) * useStore.getState().speed
  })
  return null
}

/** Maps `x` from [a, b] to [0, 1], clamped. Handy for phase windows. */
export function phase(x: number, a: number, b: number) {
  return Math.max(0, Math.min(1, (x - a) / (b - a)))
}

export const smooth = (t: number) => t * t * (3 - 2 * t)
