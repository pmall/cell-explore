import { useEffect, type DependencyList, type RefObject } from 'react'
import { useStore, type Insets } from '../state/store'

/**
 * Measures how much of the viewport the overlay's panels cover, edge by edge,
 * so the camera can frame its target in what is left (see CameraRig).
 *
 * A panel counts against the edge it sits on: wholly in the left half is the
 * left edge, wholly in the right half the right edge, and a panel that spans the
 * middle — every panel on a phone, the tour player everywhere — counts against
 * the top or bottom by which half its centre is in. One rule covers every
 * breakpoint without the code knowing what any of them look like.
 *
 * The phone menu sheet is left out (the rail and the controls while
 * `data-open`): it comes and goes in a moment, and the cell sliding away under
 * it each time would be noise.
 */
export function useInsets(overlay: RefObject<HTMLElement | null>, deps: DependencyList) {
  const setInsets = useStore((s) => s.setInsets)

  useEffect(() => {
    const root = overlay.current
    if (!root) return

    const measure = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 }
      for (const el of root.querySelectorAll<HTMLElement>('.panel')) {
        if (el.dataset.open === 'true') continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right < w / 2) insets.left = Math.max(insets.left, r.right)
        else if (r.left > w / 2) insets.right = Math.max(insets.right, w - r.left)
        else if (r.top + r.height / 2 < h / 2) insets.top = Math.max(insets.top, r.bottom)
        else insets.bottom = Math.max(insets.bottom, h - r.top)
      }
      for (const k of Object.keys(insets) as (keyof Insets)[]) insets[k] = Math.round(insets[k])
      setInsets(insets)
    }

    const ro = new ResizeObserver(measure)
    for (const el of root.querySelectorAll('.panel')) ro.observe(el)
    window.addEventListener('resize', measure)
    // Panels slide in on a transform, which no ResizeObserver reports; measure
    // again once they have arrived.
    root.addEventListener('animationend', measure)
    measure()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      root.removeEventListener('animationend', measure)
    }
  }, deps)
}
