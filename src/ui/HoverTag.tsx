import { useEffect, useLayoutEffect, useRef } from 'react'
import { LABEL_BY_ID } from '../data/content'
import { useStore } from '../state/store'

/**
 * A label that follows the cursor over whatever is under it — a structure or
 * one of the molecules moving through a process. Kept in the DOM rather than in
 * the 3D scene: text stays crisp, and it costs nothing.
 */
export function HoverTag() {
  const hovered = useStore((s) => s.hovered)
  const showLabels = useStore((s) => s.showLabels)
  const ref = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0, y: 0 })

  // The cursor is tracked all the time, not only while something is hovered.
  // The pointermove that sets `hovered` has already been dispatched by the time
  // the tag mounts, so a tag that waited for the next one sat unpositioned in
  // the corner until the cursor moved again — forever, if it had stopped.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
      place(ref.current, pointer.current)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const label = hovered && showLabels ? LABEL_BY_ID[hovered] : null

  useLayoutEffect(() => {
    place(ref.current, pointer.current)
  }, [label])

  if (!label) return null

  return (
    <div className="hover-tag" ref={ref}>
      <span className="swatch" style={{ background: label.color, color: label.color }} />
      <span>
        {label.name}
        {label.aka && <span className="aka"> · {label.aka}</span>}
      </span>
    </div>
  )
}

function place(el: HTMLDivElement | null, { x, y }: { x: number; y: number }) {
  if (!el) return
  // Flip to the left of the cursor near the right edge so it never clips.
  const flip = x > window.innerWidth - 240
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.transform = flip ? 'translate(calc(-100% - 14px), -50%)' : 'translate(14px, -50%)'
}
