import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MembraneMaterial } from '../lib/materials'
import { resolvePick } from './picking'
import { useHighlightSet, useStore } from '../state/store'
import type { StructureId } from '../data/content'

/** How far unrelated structures fade back when something is highlighted. */
const DIMMED = 0.13
const FADE_SPEED = 2.6

const baseOpacity = new WeakMap<THREE.Material, number>()

function applyDim(object: THREE.Object3D, dim: number) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (!material) return
    const list = Array.isArray(material) ? material : [material]
    for (const m of list) {
      if (m instanceof MembraneMaterial) {
        m.dim = dim
        continue
      }
      // Anything else (standard/basic materials) fades via plain opacity.
      if (!baseOpacity.has(m)) baseOpacity.set(m, m.opacity)
      const base = baseOpacity.get(m) ?? 1
      const next = base * dim
      if (Math.abs(m.opacity - next) > 0.001) {
        m.opacity = next
        m.transparent = true
      }
    }
  })
}

type Props = {
  id: StructureId
  children: ReactNode
  /** Set false for decorative bulk (hundreds of ribosomes) to keep picking cheap. */
  interactive?: boolean
  /** Structures that should stay visible even when another one is highlighted. */
  neverDim?: boolean
}

/**
 * Wraps one anatomical structure. It owns two things: the fade that pushes
 * unrelated organelles into the background during a tour, and the hover/click
 * plumbing that opens the info panel.
 */
export function Highlightable({ id, children, interactive = true, neverDim = false }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const highlightSet = useHighlightSet()
  const hover = useStore((s) => s.hover)
  const select = useStore((s) => s.select)
  const current = useRef(1)
  const settled = useRef(false)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const target = !highlightSet || neverDim || highlightSet.has(id) ? 1 : DIMMED

    if (settled.current && Math.abs(target - current.current) < 0.001) return

    const step = Math.min(1, delta * FADE_SPEED)
    current.current += (target - current.current) * step
    if (Math.abs(target - current.current) < 0.001) {
      current.current = target
      settled.current = true
    } else {
      settled.current = false
    }
    // Walking the subtree is the expensive part, so only do it while fading.
    applyDim(group, current.current)
  })

  /**
   * The handlers live on every structure but they all resolve the *same*
   * winner from the shared hit list, so whichever one fires first (the nearest,
   * usually the plasma membrane) answers for the whole event and stops there.
   * See picking.ts for why the nearest hit is not the right answer.
   */
  const handlers = interactive
    ? {
        onPointerMove: (e: { stopPropagation: () => void; intersections: { object: THREE.Object3D }[] }) => {
          e.stopPropagation()
          const picked = resolvePick(e.intersections) ?? id
          if (useStore.getState().hovered !== picked) hover(picked)
          document.body.style.cursor = 'pointer'
        },
        onPointerOut: () => {
          hover(null)
          document.body.style.cursor = 'auto'
        },
        onClick: (e: { stopPropagation: () => void; intersections: { object: THREE.Object3D }[] }) => {
          e.stopPropagation()
          select(resolvePick(e.intersections) ?? id)
        },
      }
    : {}

  return (
    <group ref={groupRef} userData={{ structureId: id }} {...handlers}>
      {children}
    </group>
  )
}
