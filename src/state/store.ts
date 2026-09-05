import { useMemo } from 'react'
import { create } from 'zustand'
import * as THREE from 'three'
import {
  OVERVIEW_FOCUS, STRUCTURE_BY_ID, TOUR_BY_ID,
  type Focus, type MechanismId, type StructureId,
} from '../data/content'

export type Quality = 'low' | 'high'

type CameraGoal = {
  target: THREE.Vector3
  distance: number
  /** Bumped on every request so the rig knows a new goal arrived. */
  nonce: number
}

type State = {
  selected: StructureId | null
  hovered: StructureId | null

  tourId: string | null
  stepIndex: number
  playing: boolean
  /** Wall-clock seconds elapsed inside the current step. */
  stepElapsed: number

  showLabels: boolean
  quality: Quality
  speed: number
  cameraGoal: CameraGoal
  intro: boolean

  select: (id: StructureId | null) => void
  hover: (id: StructureId | null) => void
  focusOn: (focus: Focus) => void

  startTour: (id: string) => void
  exitTour: () => void
  goToStep: (index: number) => void
  nextStep: () => void
  prevStep: () => void
  setPlaying: (playing: boolean) => void
  tickTour: (dt: number) => void

  setShowLabels: (v: boolean) => void
  setQuality: (q: Quality) => void
  setSpeed: (s: number) => void
  dismissIntro: () => void
}

const initialGoal: CameraGoal = {
  target: OVERVIEW_FOCUS.target.clone(),
  distance: OVERVIEW_FOCUS.distance,
  nonce: 0,
}

export const useStore = create<State>((set, get) => ({
  selected: null,
  hovered: null,
  tourId: null,
  stepIndex: 0,
  playing: false,
  stepElapsed: 0,
  showLabels: true,
  quality: 'high',
  speed: 1,
  cameraGoal: initialGoal,
  intro: true,

  select: (id) => {
    if (id === null) {
      set({ selected: null })
      return
    }
    const structure = STRUCTURE_BY_ID[id]
    set((s) => ({
      selected: id,
      // Selecting something by hand steps out of a running tour.
      tourId: null,
      playing: false,
      cameraGoal: structure
        ? { target: structure.focus.target.clone(), distance: structure.focus.distance, nonce: s.cameraGoal.nonce + 1 }
        : s.cameraGoal,
    }))
  },

  hover: (id) => set({ hovered: id }),

  focusOn: (focus) =>
    set((s) => ({
      cameraGoal: { target: focus.target.clone(), distance: focus.distance, nonce: s.cameraGoal.nonce + 1 },
    })),

  startTour: (id) => {
    const tour = TOUR_BY_ID[id]
    if (!tour) return
    const step = tour.steps[0]
    set((s) => ({
      tourId: id,
      stepIndex: 0,
      stepElapsed: 0,
      playing: true,
      selected: null,
      intro: false,
      cameraGoal: { target: step.focus.target.clone(), distance: step.focus.distance, nonce: s.cameraGoal.nonce + 1 },
    }))
  },

  exitTour: () =>
    set((s) => ({
      tourId: null,
      playing: false,
      stepElapsed: 0,
      cameraGoal: { target: OVERVIEW_FOCUS.target.clone(), distance: OVERVIEW_FOCUS.distance, nonce: s.cameraGoal.nonce + 1 },
    })),

  goToStep: (index) => {
    const { tourId } = get()
    const tour = tourId ? TOUR_BY_ID[tourId] : null
    if (!tour) return
    const clamped = Math.max(0, Math.min(tour.steps.length - 1, index))
    const step = tour.steps[clamped]
    set((s) => ({
      stepIndex: clamped,
      stepElapsed: 0,
      cameraGoal: { target: step.focus.target.clone(), distance: step.focus.distance, nonce: s.cameraGoal.nonce + 1 },
    }))
  },

  nextStep: () => {
    const { tourId, stepIndex, goToStep, exitTour } = get()
    const tour = tourId ? TOUR_BY_ID[tourId] : null
    if (!tour) return
    if (stepIndex >= tour.steps.length - 1) exitTour()
    else goToStep(stepIndex + 1)
  },

  prevStep: () => get().goToStep(get().stepIndex - 1),

  setPlaying: (playing) => set({ playing }),

  tickTour: (dt) => {
    const { tourId, playing, stepElapsed, stepIndex, nextStep } = get()
    if (!tourId || !playing) return
    const tour = TOUR_BY_ID[tourId]
    const step = tour?.steps[stepIndex]
    if (!step) return
    const next = stepElapsed + dt
    if (next >= step.duration) nextStep()
    else set({ stepElapsed: next })
  },

  setShowLabels: (showLabels) => set({ showLabels }),
  setQuality: (quality) => set({ quality }),
  setSpeed: (speed) => set({ speed }),
  dismissIntro: () => set({ intro: false }),
}))

/**
 * Which structures should stay bright. `null` means "everything" — used when
 * the viewer is exploring freely rather than following a tour.
 *
 * The Set is built in useMemo, not in the selector: zustand compares selector
 * results with Object.is, so returning a fresh Set on every read would report a
 * change every render and spin into an infinite update loop.
 */
export function useHighlightSet(): Set<StructureId> | null {
  const tourId = useStore((s) => s.tourId)
  const stepIndex = useStore((s) => s.stepIndex)
  const selected = useStore((s) => s.selected)

  return useMemo(() => {
    if (tourId) {
      const step = TOUR_BY_ID[tourId]?.steps[stepIndex]
      if (step && step.highlight.length > 0) return new Set(step.highlight)
      return null
    }
    if (selected) return new Set([selected])
    return null
  }, [tourId, stepIndex, selected])
}

export function useActiveMechanism(): MechanismId | null {
  return useStore((s) => {
    if (!s.tourId) return null
    return TOUR_BY_ID[s.tourId]?.steps[s.stepIndex]?.mechanism ?? null
  })
}
