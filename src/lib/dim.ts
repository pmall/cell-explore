import * as THREE from 'three'
import { MembraneMaterial } from './materials'

/**
 * Fading things into the background is how both kinds of focus are expressed:
 * a tour step pushes back the structures it is not talking about, and it pushes
 * back the four processes it is not showing. Same effect, one implementation —
 * two of them would mean two writers on the same materials, and whichever ran
 * second each frame would win.
 *
 * The shell shader has its own `uDim` uniform because its alpha is built from a
 * fresnel term rather than from `opacity`; everything else fades on plain
 * opacity, remembered here so repeated fades compound from the original value
 * rather than from the last faded one.
 */
const baseOpacity = new WeakMap<THREE.Material, number>()

export function applyDim(root: THREE.Object3D, dim: number) {
  root.traverse((child) => {
    const material = (child as THREE.Mesh).material as
      | THREE.Material
      | THREE.Material[]
      | undefined
    if (!material) return
    for (const m of Array.isArray(material) ? material : [material]) {
      if (m instanceof MembraneMaterial) {
        m.dim = dim
        continue
      }
      if (!baseOpacity.has(m)) baseOpacity.set(m, m.opacity)
      const next = (baseOpacity.get(m) ?? 1) * dim
      if (Math.abs(m.opacity - next) > 0.001) {
        m.opacity = next
        m.transparent = true
      }
    }
  })
}

/**
 * Eases a dim level towards `target` and reports whether the subtree needs
 * repainting. Walking the subtree is the expensive part, so a group that has
 * reached its target — which is most groups, most frames — does nothing at all.
 */
export class DimLevel {
  private current = 1
  private settled = true

  /** Call once per frame; returns the level to paint, or null if unchanged. */
  step(target: number, delta: number, speed: number): number | null {
    if (this.settled && Math.abs(target - this.current) < 0.001) return null
    this.current += (target - this.current) * Math.min(1, delta * speed)
    this.settled = Math.abs(target - this.current) < 0.001
    if (this.settled) this.current = target
    return this.current
  }
}
