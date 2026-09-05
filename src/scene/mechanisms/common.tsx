import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MembraneMaterial } from '../../lib/materials'
import { useActiveMechanism } from '../../state/store'
import type { MechanismId } from '../../data/content'

/** How far the other processes recede while a tour is discussing one of them. */
const BACKGROUND = 0.22

const baseOpacity = new WeakMap<THREE.Material, number>()

/**
 * All five processes run continuously — a cell does not do one thing at a time,
 * and the constant background motion is most of what makes the scene feel
 * alive. When a tour is explaining one of them, the rest step back.
 */
export function MechanismGroup({ id, children }: { id: MechanismId; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const active = useActiveMechanism()
  const level = useRef(1)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const target = !active || active === id ? 1 : BACKGROUND
    level.current += (target - level.current) * Math.min(1, delta * 2.5)
    const dim = level.current

    g.traverse((child) => {
      const mesh = child as THREE.Mesh
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (!material) return
      for (const m of Array.isArray(material) ? material : [material]) {
        if (m instanceof MembraneMaterial) {
          m.dim = dim
          continue
        }
        if (!baseOpacity.has(m)) baseOpacity.set(m, m.opacity)
        m.opacity = (baseOpacity.get(m) ?? 1) * dim
        m.transparent = true
      }
    })
  })

  return <group ref={group}>{children}</group>
}

/** A soft, slightly irregular blob — the generic stand-in for "a protein". */
export function proteinGeometry(radius: number, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(radius, 3)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n =
      Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2) * Math.sin(v.z * 6.2 + seed * 3)
    v.multiplyScalar(1 + n * 0.22)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** A wiggly strand, for free mRNA and unfolded polypeptides. */
export function strandCurve(length: number, wiggles = 4, amplitude = 0.14, seed = 0) {
  const points: THREE.Vector3[] = []
  const steps = 26
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push(
      new THREE.Vector3(
        (t - 0.5) * length,
        Math.sin(t * Math.PI * wiggles + seed) * amplitude,
        Math.cos(t * Math.PI * wiggles * 0.8 + seed * 1.7) * amplitude,
      ),
    )
  }
  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
}
