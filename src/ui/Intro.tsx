import { useStore } from '../state/store'
import { TOURS } from '../data/content'

export function Intro() {
  const dismiss = useStore((s) => s.dismissIntro)
  const startTour = useStore((s) => s.startTour)

  return (
    <div className="intro" onClick={dismiss}>
      <div className="panel intro-card" onClick={(e) => e.stopPropagation()}>
        <h1>Inside a Cell</h1>
        <p className="lede">
          Everything here is happening at once, all the time — the same way it does in each of the
          thirty trillion cells you are made of. Fly in and look around.
        </p>
        <ul>
          <li><b>Drag</b> to orbit around the cell</li>
          <li><b>Scroll</b> to fly in and out</li>
          <li><b>Click</b> anything to learn what it is</li>
          <li><b>Tours</b> walk you through a process step by step</li>
        </ul>
        <div className="intro-actions">
          <button className="btn primary" onClick={() => startTour(TOURS[0].id)}>
            Take the first look ›
          </button>
          <button className="btn" onClick={dismiss}>
            Explore on my own
          </button>
        </div>
        <p className="note">
          Shapes and proportions follow the real biology; sizes of the smallest parts are
          exaggerated so they can be seen at all. Colour is a labelling device — cells are
          essentially transparent.
        </p>
      </div>
    </div>
  )
}
