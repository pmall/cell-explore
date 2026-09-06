import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { capsuleBlobGeometry, sheetGeometry } from '../../lib/geometry'
import { MembraneMaterial, useMembraneMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { MITOCHONDRIA } from '../../data/layout'
import { cellTime } from '../clock'
import { Highlightable } from '../Highlightable'
import { noPick } from '../picking'

/**
 * Two membranes and a lot of folding. The outer membrane is smooth; the inner
 * one is thrown into cristae that multiply its area several-fold, because every
 * bit of that area is working surface for the electron transport chain.
 *
 * All seven mitochondria share one set of geometries and differ only by
 * transform — which is what keeps this affordable.
 */

export const LENGTH = 1.5
export const RADIUS = 0.52
const CRISTAE = 9

/**
 * Where a given mitochondrion is at time `t`. Exported because the bioenergetics
 * animation has to ride along with mitochondrion 0, and both need to agree
 * exactly — a purely accumulative rotation would drift apart between them.
 */
export function mitochondrionTransform(
  placement: (typeof MITOCHONDRIA)[number],
  index: number,
  t: number,
  target: THREE.Object3D,
) {
  const p = placement.phase
  target.position.set(
    placement.position.x + Math.sin(t * 0.13 + p) * 0.22,
    placement.position.y + Math.cos(t * 0.11 + p * 1.3) * 0.2,
    placement.position.z + Math.sin(t * 0.09 + p * 0.7) * 0.22,
  )
  target.quaternion.copy(placement.quaternion)
  target.rotateY(t * 0.04 * (index % 2 === 0 ? 1 : -1))
}

function useMitoGeometries() {
  return useMemo(() => {
    const outer = capsuleBlobGeometry(RADIUS, LENGTH, 0.1, 5, 10, 26)
    const inner = capsuleBlobGeometry(RADIUS * 0.86, LENGTH * 1.02, 0.08, 9, 10, 24)
    // Each crista is a rippled sheet reaching in from alternating sides.
    const crista = sheetGeometry(RADIUS * 1.55, RADIUS * 1.5, 0.22, 5.5, 13, 26, 18)
    crista.rotateX(-Math.PI / 2)
    return { outer, inner, crista }
  }, [])
}

function Mitochondrion({
  placement,
  index,
}: {
  placement: (typeof MITOCHONDRIA)[number]
  index: number
}) {
  const { outer, inner, crista } = useMitoGeometries()
  const group = useRef<THREE.Group>(null)

  const outerMat = useMembraneMaterial({
    base: palette.mitoOuter.base,
    rim: palette.mitoOuter.rim,
    opacity: 0.17,
    rimStrength: 0.75,
    rimPower: 2.0,
    emissive: 0.45,
    side: THREE.FrontSide,
    wobble: 0.012,
    wobbleFreq: 3.0,
  })
  const innerMat = useMembraneMaterial({
    base: palette.mitoInner.base,
    rim: palette.mitoInner.rim,
    opacity: 0.12,
    rimStrength: 0.4,
    rimPower: 2.6,
    emissive: 0.24,
    side: THREE.BackSide,
  })
  const cristaMat = useMembraneMaterial({
    base: palette.crista.base,
    rim: palette.crista.rim,
    opacity: 0.46,
    rimStrength: 0.5,
    rimPower: 2.0,
    emissive: 0.38,
    edgeFade: 0.85,
    wobble: 0.01,
    wobbleFreq: 6,
  })

  useFrame(() => {
    const t = cellTime()
    ;[outerMat, innerMat, cristaMat].forEach((m) => ((m as MembraneMaterial).time = t))
    const g = group.current
    if (!g) return
    // Mitochondria are motile: they drift, rotate and jostle constantly.
    mitochondrionTransform(placement, index, t, g)
  })

  const cristaPositions = useMemo(
    () =>
      Array.from({ length: CRISTAE }, (_, i) => {
        const t = (i + 1) / (CRISTAE + 1)
        return {
          y: (t - 0.5) * LENGTH * 1.55,
          side: i % 2 === 0 ? 1 : -1,
          tilt: Math.sin(i * 2.3) * 0.22,
        }
      }),
    [],
  )

  return (
    <group ref={group}>
      <group scale={placement.scale}>
        <mesh geometry={outer} material={outerMat} renderOrder={2} />
        <mesh geometry={inner} material={innerMat} renderOrder={2} raycast={noPick} />
        {cristaPositions.map((c, i) => (
          <mesh
            key={i}
            geometry={crista}
            material={cristaMat}
            position={[c.side * RADIUS * 0.3, c.y, 0]}
            rotation={[c.tilt, i * 0.3, 0]}
            renderOrder={3}
            raycast={noPick}
          />
        ))}
      </group>
    </group>
  )
}

export function Mitochondria() {
  return (
    <Highlightable id="mitochondrion">
      {MITOCHONDRIA.map((m, i) => (
        <Mitochondrion key={m.id} placement={m} index={i} />
      ))}
    </Highlightable>
  )
}
