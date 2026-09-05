import { useStore } from '../state/store'
import type { Tour } from '../data/content'

export function TourPlayer({ tour }: { tour: Tour }) {
  const stepIndex = useStore((s) => s.stepIndex)
  const stepElapsed = useStore((s) => s.stepElapsed)
  const playing = useStore((s) => s.playing)
  const nextStep = useStore((s) => s.nextStep)
  const prevStep = useStore((s) => s.prevStep)
  const goToStep = useStore((s) => s.goToStep)
  const setPlaying = useStore((s) => s.setPlaying)
  const exitTour = useStore((s) => s.exitTour)

  const step = tour.steps[stepIndex]
  if (!step) return null

  return (
    <section className="panel player">
      <button className="close" onClick={exitTour} aria-label="Leave tour">
        ×
      </button>
      <div className="eyebrow">
        <span className="swatch" style={{ background: tour.color, color: tour.color }} />
        {tour.name} · {stepIndex + 1} of {tour.steps.length}
      </div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>

      <div className="player-controls">
        <button className="btn icon" onClick={prevStep} disabled={stepIndex === 0} aria-label="Previous">
          ‹
        </button>
        <button
          className="btn icon"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="dots">
          {tour.steps.map((s, i) => (
            <button
              key={i}
              className="dot"
              onClick={() => goToStep(i)}
              aria-label={`Step ${i + 1}: ${s.title}`}
            >
              <span
                style={{
                  transform: `scaleX(${
                    i < stepIndex ? 1 : i === stepIndex ? Math.min(1, stepElapsed / step.duration) : 0
                  })`,
                  transition: i === stepIndex && playing ? 'transform 0.2s linear' : 'none',
                }}
              />
            </button>
          ))}
        </div>
        <button className="btn" onClick={nextStep}>
          {stepIndex === tour.steps.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </section>
  )
}
