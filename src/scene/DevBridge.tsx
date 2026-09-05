import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { useStore } from '../state/store'

/**
 * Dev-only: exposes the three.js scene and a rolling FPS figure on `window` so
 * the scene can be inspected and profiled from outside the app. Tree-shaken out
 * of production builds.
 */
export function DevBridge() {
  const state = useThree()
  const frames = useRef({ count: 0, last: performance.now(), fps: 0 })

  useFrame(() => {
    const f = frames.current
    f.count++
    const now = performance.now()
    if (now - f.last >= 1000) {
      f.fps = (f.count * 1000) / (now - f.last)
      f.count = 0
      f.last = now
    }
    const w = window as unknown as Record<string, unknown>
    w.__scene = state.scene
    w.__camera = state.camera
    w.__gl = state.gl
    w.__fps = f.fps
    w.__store = useStore
  })

  return null
}
