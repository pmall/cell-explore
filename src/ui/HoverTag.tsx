import { useEffect, useRef, useState } from 'react'
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
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!hovered || !showLabels) {
      setVisible(false)
      return
    }
    setVisible(true)
    const move = (e: PointerEvent) => {
      const el = ref.current
      if (!el) return
      // Flip to the left of the cursor near the right edge so it never clips.
      const flip = e.clientX > window.innerWidth - 240
      el.style.left = `${e.clientX}px`
      el.style.top = `${e.clientY}px`
      el.style.transform = flip ? 'translate(calc(-100% - 14px), -50%)' : 'translate(14px, -50%)'
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [hovered, showLabels])

  if (!visible || !hovered) return null
  const label = LABEL_BY_ID[hovered]
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
