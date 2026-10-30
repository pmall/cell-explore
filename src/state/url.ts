import { STRUCTURE_BY_ID, TOUR_BY_ID, type StructureId } from '../data/content'
import { useStore } from './store'

/**
 * The address bar mirrors what is on screen, so any view can be shared or
 * bookmarked:
 *
 *   #/mitochondrion          a structure, selected
 *   #/tour/centralDogma/3    a tour, at its third step
 *
 * Written with replaceState, never pushState: a playing tour advances on its
 * own every few seconds, and each step becoming a history entry would turn the
 * Back button into a way of rewinding the tour one step at a time.
 */
type View =
  | { kind: 'structure'; id: StructureId }
  | { kind: 'tour'; id: string; step: number }
  | { kind: 'overview' }

function parse(hash: string): View | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length === 0) return { kind: 'overview' }
  if (parts[0] === 'tour' && parts[1] && TOUR_BY_ID[parts[1]]) {
    const step = Number.parseInt(parts[2] ?? '1', 10)
    return { kind: 'tour', id: parts[1], step: Number.isFinite(step) ? step : 1 }
  }
  if (parts[0] in STRUCTURE_BY_ID) return { kind: 'structure', id: parts[0] as StructureId }
  return null
}

function format(s: { selected: StructureId | null; tourId: string | null; stepIndex: number }) {
  if (s.tourId) return `#/tour/${encodeURIComponent(s.tourId)}/${s.stepIndex + 1}`
  if (s.selected) return `#/${encodeURIComponent(s.selected)}`
  return ''
}

function apply(view: View | null) {
  const s = useStore.getState()
  if (!view) return
  if (view.kind === 'overview') {
    if (s.tourId) s.exitTour()
    if (s.selected) s.select(null)
    return
  }
  s.dismissIntro()
  if (view.kind === 'structure') {
    if (s.selected !== view.id) s.select(view.id)
    return
  }
  if (s.tourId !== view.id) s.startTour(view.id)
  if (useStore.getState().stepIndex !== view.step - 1) s.goToStep(view.step - 1)
}

/** Call once at startup: applies the incoming link, then keeps the URL in step. */
export function startUrlSync() {
  apply(location.hash ? parse(location.hash) : null)
  window.addEventListener('hashchange', () => apply(parse(location.hash)))

  useStore.subscribe((s, prev) => {
    if (s.selected === prev.selected && s.tourId === prev.tourId && s.stepIndex === prev.stepIndex) return
    const hash = format(s)
    if (hash === location.hash) return
    history.replaceState(history.state, '', hash || location.pathname + location.search)
  })
}
