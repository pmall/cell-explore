import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { applyDim, DimLevel } from '../lib/dim'
import { useHoverName } from './Nameable'
import { useHighlightSet } from '../state/store'
import type { StructureId } from '../data/content'

/** How far unrelated structures fade back when something is highlighted. */
const DIMMED = 0.13
const FADE_SPEED = 2.6

type Props = {
  id: StructureId
  children: ReactNode
  /** Structures that should stay visible even when another one is highlighted. */
  neverDim?: boolean
}

/**
 * Wraps one anatomical structure. It owns two things: the fade that pushes
 * unrelated organelles into the background during a tour, and the name the
 * cursor tooltip shows.
 *
 * Hover only. The scene names what is under the cursor; it never selects.
 * Clicking a structure was removed because depth-ordered picking through a
 * stack of nested membranes could not reliably answer *which* structure the
 * viewer meant — selection comes from the index in the rail, where the intent
 * is unambiguous. A wrong tooltip is a small cost; a wrong camera flight is not.
 */
export function Highlightable({ id, children, neverDim = false }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const highlightSet = useHighlightSet()
  const level = useRef(new DimLevel())
  const handlers = useHoverName(id)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const target = !highlightSet || neverDim || highlightSet.has(id) ? 1 : DIMMED
    const dim = level.current.step(target, delta, FADE_SPEED)
    if (dim !== null) applyDim(group, dim)
  })

  return (
    <group ref={groupRef} userData={{ labelId: id }} {...handlers}>
      {children}
    </group>
  )
}
