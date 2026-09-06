import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cisternaGeometry, orientToDirection } from '../../lib/geometry'
import { MembraneMaterial, useMembraneMaterial, useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { GOLGI } from '../../data/layout'
import { Rng } from '../../lib/rng'
import { Highlightable } from '../Highlightable'
import { noPick } from '../picking'
import { cellTime } from '../clock'

/**
 * A stack of flattened sacs. Cargo enters at the cis face (nearest the ER) and
 * leaves at the trans face, and the colour shift across the stack stands in for
 * the progressive sugar-chain remodelling that happens on the way through.
 */

function Cisterna({ index, count }: { index: number; count: number }) {
  const t = index / (count - 1)
  // The stack is widest in the middle: cis and trans faces are both smaller.
  const radius = GOLGI.radius * (0.72 + 0.34 * Math.sin(Math.PI * (0.16 + t * 0.76)))
  const geo = useMemo(
    () => cisternaGeometry(radius, 0.075, 0.26, 0.09, 100 + index),
    [radius, index],
  )

  const base = new THREE.Color(palette.golgi.base).lerp(new THREE.Color(palette.golgiTrans.base), t)
  const rim = new THREE.Color(palette.golgi.rim).lerp(new THREE.Color(palette.golgiTrans.rim), t)

  const mat = useMembraneMaterial({
    base: `#${base.getHexString()}`,
    rim: `#${rim.getHexString()}`,
    opacity: 0.3,
    rimStrength: 0.7,
    rimPower: 2.0,
    emissive: 0.45,
    wobble: 0.015,
    wobbleFreq: 3.2,
  })

  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const t = cellTime()
    ;(mat as MembraneMaterial).time = t
    const m = ref.current
    if (!m) return
    // Cisternae are not rigid — they flex slowly.
    m.rotation.y = Math.sin(t * 0.15 + index) * 0.06
  })

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      position={[0, (index - (count - 1) / 2) * 0.34, 0]}
      rotation={[Math.sin(index * 1.7) * 0.04, index * 0.42, Math.cos(index * 1.3) * 0.04]}
      renderOrder={2}
    />
  )
}

/** Vesicles budding off the rims of the stack, in both directions. */
function GolgiVesicles() {
  const items = useMemo(() => {
    const rng = new Rng(24680)
    return Array.from({ length: 34 }, () => {
      const a = rng.range(0, Math.PI * 2)
      const r = GOLGI.radius * rng.range(0.95, 1.35)
      return {
        base: new THREE.Vector3(Math.cos(a) * r, rng.range(-1.1, 1.1), Math.sin(a) * r),
        scale: rng.range(0.06, 0.13),
        phase: rng.range(0, Math.PI * 2),
        speed: rng.range(0.3, 0.7),
      }
    })
  }, [])

  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const mat = useSolidMaterial(palette.vesicle.base, { emissive: 0.45 })
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = cellTime()
    items.forEach((item, i) => {
      const drift = Math.sin(t * item.speed + item.phase)
      dummy.position.copy(item.base)
      dummy.position.x += drift * 0.12
      dummy.position.y += Math.cos(t * item.speed * 0.8 + item.phase) * 0.1
      dummy.position.z += drift * 0.08
      dummy.scale.setScalar(item.scale * (0.85 + 0.15 * Math.sin(t * 2 + item.phase)))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} raycast={noPick} />
  )
}

export function Golgi() {
  const quaternion = useMemo(() => orientToDirection(GOLGI.axis), [])

  return (
    <Highlightable id="golgi">
      <group position={GOLGI.center} quaternion={quaternion}>
        {Array.from({ length: GOLGI.cisternae }, (_, i) => (
          <Cisterna key={i} index={i} count={GOLGI.cisternae} />
        ))}
        <GolgiVesicles />
      </group>
    </Highlightable>
  )
}
