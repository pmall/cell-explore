import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store'

/**
 * A single clock for every biological process in the scene, scaled by the
 * viewer's speed control.
 *
 * The rule is: anything inside the cell reads `cellTime()`; only the camera
 * reads the render clock. That is what lets the speed control mean what it
 * says — at 0 the biology genuinely stops, membranes and drifting organelles
 * included, while the viewer can still orbit and fly around a frozen cell.
 * Mixing the two clocks leaves half the scene twitching through a "pause", and
 * makes the other half jump whenever the speed changes.
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
