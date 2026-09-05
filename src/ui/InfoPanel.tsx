import { useStore } from '../state/store'
import type { Structure } from '../data/content'

export function InfoPanel({ structure }: { structure: Structure }) {
  const select = useStore((s) => s.select)

  return (
    <aside className="panel info" key={structure.id}>
      <button className="close" onClick={() => select(null)} aria-label="Close">
        ×
      </button>
      <div className="info-head">
        <div className="eyebrow">
          <span className="swatch" style={{ background: structure.color, color: structure.color }} />
          {structure.aka ?? 'Structure'}
        </div>
        <h2>{structure.name}</h2>
        <p className="tagline">{structure.tagline}</p>
      </div>
      <div className="info-body">
        <p>{structure.body}</p>
        <h3>Worth knowing</h3>
        <ul className="facts">
          {structure.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        <span className="size-chip">Real size: {structure.size}</span>
      </div>
    </aside>
  )
}
