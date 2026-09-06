import { useEffect, useState } from 'react'
import { STRUCTURES, STRUCTURE_BY_ID, TOURS, TOUR_BY_ID } from '../data/content'
import { useStore } from '../state/store'
import { Intro } from './Intro'
import { InfoPanel } from './InfoPanel'
import { TourPlayer } from './TourPlayer'
import { HoverTag } from './HoverTag'

type Tab = 'tours' | 'index'

export function Overlay() {
  const [tab, setTab] = useState<Tab>('tours')
  // Phone layout only: the rail is a sheet the masthead button opens. On wider
  // screens it is always on show and this flag is ignored.
  const [menuOpen, setMenuOpen] = useState(false)
  const selected = useStore((s) => s.selected)
  const tourId = useStore((s) => s.tourId)
  const intro = useStore((s) => s.intro)
  const select = useStore((s) => s.select)
  const startTour = useStore((s) => s.startTour)
  const exitTour = useStore((s) => s.exitTour)
  const nextStep = useStore((s) => s.nextStep)
  const prevStep = useStore((s) => s.prevStep)
  const setPlaying = useStore((s) => s.setPlaying)

  // Keyboard: the whole thing should be usable without touching the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const s = useStore.getState()
      if (e.key === 'Escape') {
        if (menuOpen) setMenuOpen(false)
        else if (s.selected) select(null)
        else if (s.tourId) exitTour()
        else if (s.intro) s.dismissIntro()
      } else if (s.tourId && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
        e.preventDefault()
        nextStep()
      } else if (s.tourId && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
        e.preventDefault()
        prevStep()
      } else if (e.key === ' ' && s.tourId) {
        e.preventDefault()
        setPlaying(!s.playing)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select, exitTour, nextStep, prevStep, setPlaying, menuOpen])

  return (
    <>
      <div className="overlay">
        <header className="panel masthead">
          <div>
            <h1>Inside a Cell</h1>
            <p>An interactive tour of a living animal cell</p>
          </div>
          <button
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="rail"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? 'Close' : 'Tours & index'}
          </button>
        </header>

        <nav className="panel rail" id="rail" data-open={menuOpen}>
          <div className="tabs" role="tablist">
            <button
              className="tab"
              role="tab"
              aria-selected={tab === 'tours'}
              onClick={() => setTab('tours')}
            >
              Guided tours
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={tab === 'index'}
              onClick={() => setTab('index')}
            >
              Index
            </button>
          </div>

          <div className="rail-body">
            {tab === 'tours' &&
              TOURS.map((tour) => (
                <button
                  key={tour.id}
                  className="tour-card"
                  data-active={tourId === tour.id}
                  onClick={() => {
                    startTour(tour.id)
                    setMenuOpen(false)
                  }}
                >
                  <span className="name">
                    <span className="swatch" style={{ background: tour.color, color: tour.color }} />
                    {tour.name}
                  </span>
                  <span className="sub">{tour.subtitle}</span>
                </button>
              ))}

            {tab === 'index' &&
              STRUCTURES.map((structure) => (
                <button
                  key={structure.id}
                  className="index-item"
                  data-active={selected === structure.id}
                  onClick={() => {
                    select(structure.id)
                    setMenuOpen(false)
                  }}
                >
                  <span
                    className="swatch"
                    style={{ background: structure.color, color: structure.color }}
                  />
                  <span>
                    {structure.name}
                    {structure.aka && <span className="aka"> · {structure.aka}</span>}
                  </span>
                </button>
              ))}
          </div>
        </nav>

        {selected && <InfoPanel structure={STRUCTURE_BY_ID[selected]} />}
        {tourId && TOUR_BY_ID[tourId] && <TourPlayer tour={TOUR_BY_ID[tourId]} />}

        <Controls />

        <div className="hint">
          drag to orbit · scroll to zoom · hover to name
          <br />
          pick from the <b>Index</b> to fly to a structure
          <br />
          <kbd>Esc</kbd> to step back
        </div>
      </div>

      <HoverTag />
      {intro && <Intro />}
    </>
  )
}

function Controls() {
  const showLabels = useStore((s) => s.showLabels)
  const setShowLabels = useStore((s) => s.setShowLabels)
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)

  return (
    <div className="panel controls">
      <div className="control-row">
        <label htmlFor="speed">Process speed</label>
        <div className="seg">
          {([0, 0.5, 1, 2] as const).map((v) => (
            <button
              key={v}
              aria-pressed={speed === v}
              onClick={() => setSpeed(v)}
              title={v === 0 ? 'Freeze the biology — the camera still moves' : `${v}×`}
            >
              {v === 0 ? 'pause' : `${v}×`}
            </button>
          ))}
        </div>
      </div>
      <div className="control-row">
        <label>Labels</label>
        <div className="seg">
          <button aria-pressed={showLabels} onClick={() => setShowLabels(true)}>on</button>
          <button aria-pressed={!showLabels} onClick={() => setShowLabels(false)}>off</button>
        </div>
      </div>
      <div className="control-row">
        <label>Graphics</label>
        <div className="seg">
          <button aria-pressed={quality === 'high'} onClick={() => setQuality('high')}>high</button>
          <button aria-pressed={quality === 'low'} onClick={() => setQuality('low')}>fast</button>
        </div>
      </div>
    </div>
  )
}
