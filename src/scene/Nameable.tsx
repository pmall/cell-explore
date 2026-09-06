import type { ReactNode } from 'react'
import * as THREE from 'three'
import { resolvePick } from './picking'
import { useStore } from '../state/store'
import type { LabelId } from '../data/content'

type PointerEvent3D = {
  stopPropagation: () => void
  intersections: { object: THREE.Object3D }[]
}

/**
 * The hover plumbing behind the cursor tooltip.
 *
 * The handlers live on every named thing but they all resolve the *same* winner
 * from the shared hit list, so whichever one fires first (the nearest, usually
 * the plasma membrane) answers for the whole event and stops there. See
 * picking.ts for why the nearest hit is not the right answer.
 */
export function useHoverName(id: LabelId) {
  const hover = useStore((s) => s.hover)

  return {
    onPointerMove: (e: PointerEvent3D) => {
      e.stopPropagation()
      const picked = resolvePick(e.intersections) ?? id
      if (useStore.getState().hovered !== picked) hover(picked)
    },
    onPointerOut: () => {
      hover(null)
    },
  }
}

/**
 * Gives a subtree a name for the hover tooltip, and nothing else.
 *
 * This is the whole of what the animated processes need. They are already faded
 * as a group by MechanismGroup, so wrapping them in a Highlightable would put a
 * second writer on the same materials; and r3f only reports a hit whose object
 * has a handler somewhere above it, so without a wrapper like this one their
 * meshes are absent from the hit list entirely and the tooltip names whatever
 * anatomy happens to sit behind them.
 */
export function Nameable({ id, children }: { id: LabelId; children: ReactNode }) {
  const handlers = useHoverName(id)

  return (
    <group userData={{ labelId: id }} {...handlers}>
      {children}
    </group>
  )
}
