import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { blobGeometry, ribosomeGeometry } from '../../lib/geometry'
import { MembraneMaterial, useMembraneMaterial, useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { CYTOSOL_VESICLES, FREE_RIBOSOMES, LYSOSOMES, PEROXISOMES } from '../../data/layout'
import type { ColorPair } from '../../theme/palette'
import type { StructureId } from '../../data/content'
import { Highlightable } from '../Highlightable'

/**
 * The small round bodies: lysosomes, peroxisomes and loose transport vesicles.
 * They share one implementation because structurally they are the same thing —
 * a single membrane around a compartment — and differ by what is inside.
 */

type Placements = typeof LYSOSOMES

function VesicleField({
  id,
  placements,
  colors,
  radius,
  cargo,
  cargoColor,
  drift = 0.28,
}: {
  id: StructureId
  placements: Placements
  colors: ColorPair
  radius: number
  /** Number of granules shown inside — enzymes, or whatever the body carries. */
  cargo?: number
  cargoColor?: string
  drift?: number
}) {
  // detail 16 is smooth enough at normal range but visibly faceted when a
  // flythrough passes within a unit of one, and several tours do. There are only
  // twenty-two of these bodies in the whole cell; 24 is where the silhouette
  // stops showing flats without the triangle count running away.
  const geo = useMemo(() => blobGeometry(radius, 24, 0.14, 3.2, 900 + radius * 100), [radius])
  const mat = useMembraneMaterial({
    base: colors.base,
    rim: colors.rim,
    opacity: 0.34,
    rimStrength: 0.7,
    rimPower: 2.0,
    emissive: 0.45,
    side: THREE.FrontSide,
    wobble: 0.012,
    wobbleFreq: 5,
  })

  const cargoGeo = useMemo(() => new THREE.IcosahedronGeometry(radius * 0.14, 0), [radius])
  const cargoMat = useSolidMaterial(cargoColor ?? colors.rim, { emissive: 0.7, flatShading: true })
  const cargoRef = useRef<THREE.InstancedMesh>(null)
  const groupRefs = useRef<(THREE.Group | null)[]>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const cargoLayout = useMemo(() => {
    if (!cargo) return []
    const out: { parent: number; offset: THREE.Vector3; spin: number }[] = []
    placements.forEach((_, pi) => {
      for (let i = 0; i < cargo; i++) {
        const a = (i / cargo) * Math.PI * 2 + pi
        const r = radius * 0.45 * (0.4 + ((i * 37) % 10) / 14)
        out.push({
          parent: pi,
          offset: new THREE.Vector3(
            Math.cos(a) * r,
            Math.sin(a * 1.7) * r * 0.7,
            Math.sin(a) * r,
          ),
          spin: (i % 5) * 1.1,
        })
      }
    })
    return out
  }, [cargo, placements, radius])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    ;(mat as MembraneMaterial).time = t

    placements.forEach((p, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      g.position.set(
        p.position.x + Math.sin(t * 0.19 + p.phase) * drift,
        p.position.y + Math.cos(t * 0.16 + p.phase * 1.4) * drift,
        p.position.z + Math.sin(t * 0.13 + p.phase * 0.8) * drift,
      )
      g.rotation.y = t * 0.08 + p.phase
    })

    const mesh = cargoRef.current
    if (mesh) {
      cargoLayout.forEach((c, i) => {
        const p = placements[c.parent]
        const g = groupRefs.current[c.parent]
        if (!g) return
        dummy.position.copy(g.position).addScaledVector(c.offset, p.scale)
        dummy.rotation.set(t * 0.6 + c.spin, t * 0.4 + c.spin, 0)
        dummy.scale.setScalar(p.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <Highlightable id={id}>
      {placements.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => {
            groupRefs.current[i] = el
          }}
          position={p.position}
          scale={p.scale}
        >
          <mesh geometry={geo} material={mat} renderOrder={2} />
        </group>
      ))}
      {cargoLayout.length > 0 && (
        <instancedMesh
          ref={cargoRef}
          args={[cargoGeo, cargoMat, cargoLayout.length]}
          frustumCulled={false}
          raycast={() => null}
        />
      )}
    </Highlightable>
  )
}

/** Free ribosomes drifting in the cytosol — these make cytosolic proteins. */
function FreeRibosomes() {
  const geo = useMemo(() => ribosomeGeometry(0.15), [])
  const mat = useSolidMaterial(palette.ribosome, { emissive: 0.22 })
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    FREE_RIBOSOMES.forEach((p, i) => {
      // Brownian-ish wander. Real ribosomes are battered by thermal motion.
      dummy.position.set(
        p.position.x + Math.sin(t * 0.42 + p.phase) * 0.16,
        p.position.y + Math.cos(t * 0.37 + p.phase * 1.7) * 0.16,
        p.position.z + Math.sin(t * 0.31 + p.phase * 2.3) * 0.16,
      )
      dummy.rotation.set(p.phase + t * 0.12, p.phase * 2 + t * 0.09, p.phase * 0.5)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <Highlightable id="ribosome" interactive={false}>
      <instancedMesh
        ref={ref}
        args={[geo, mat, FREE_RIBOSOMES.length]}
        frustumCulled={false}
        raycast={() => null}
      />
    </Highlightable>
  )
}

export function SmallOrganelles() {
  return (
    <>
      <VesicleField
        id="lysosome"
        placements={LYSOSOMES}
        colors={palette.lysosome}
        radius={0.52}
        cargo={7}
        cargoColor={palette.lysosome.rim}
      />
      <VesicleField
        id="peroxisome"
        placements={PEROXISOMES}
        colors={palette.peroxisome}
        radius={0.36}
        cargo={4}
        cargoColor={palette.peroxisome.rim}
      />
      <VesicleField
        id="vesicle"
        placements={CYTOSOL_VESICLES}
        colors={palette.vesicle}
        radius={0.22}
        drift={0.5}
      />
      <FreeRibosomes />
    </>
  )
}
