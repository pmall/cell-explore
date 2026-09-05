import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BufferGeometryUtils, tubeGeometry } from '../../lib/geometry'
import { MembraneMaterial, useMembraneMaterial, useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { ACTIN_FILAMENTS, CENTROSOME, MICROTUBULES } from '../../data/layout'
import { Highlightable } from '../Highlightable'

const TUBULAR_SEGMENTS = 60
const RADIAL_SEGMENTS = 6
/** Indices per ring of the tube — the granularity we can truncate at. */
const INDICES_PER_SEGMENT = RADIAL_SEGMENTS * 6

/**
 * Microtubules are never at rest. Each one grows steadily for a while, then
 * undergoes "catastrophe" and shrinks back fast before regrowing. We render the
 * full tube once and reveal part of it with drawRange, which costs nothing.
 */
function Microtubule({ spec, index }: { spec: (typeof MICROTUBULES)[number]; index: number }) {
  const geometry = useMemo(
    () =>
      tubeGeometry(
        [CENTROSOME.center.clone(), spec.bend.clone(), spec.end.clone()],
        0.033,
        TUBULAR_SEGMENTS,
        RADIAL_SEGMENTS,
      ),
    [spec],
  )

  const mat = useMembraneMaterial({
    base: palette.microtubule,
    rim: '#dfe8f2',
    // These were dimmed hard because they read as white scratches across the
    // frame; that overshot, and the distance haze now does most of that job by
    // pushing the far ones back on its own, so they can come back up.
    opacity: 0.46,
    rimStrength: 0.58,
    rimPower: 1.7,
    emissive: 0.4,
    side: THREE.DoubleSide,
  })

  const ref = useRef<THREE.Mesh>(null)
  const total = TUBULAR_SEGMENTS * INDICES_PER_SEGMENT

  useFrame((state) => {
    ;(mat as MembraneMaterial).time = state.clock.elapsedTime
    const mesh = ref.current
    if (!mesh) return
    const cycle = 26 + (index % 5) * 4
    const p = ((state.clock.elapsedTime * 0.9 + spec.phase * 6) % cycle) / cycle
    // 80% of the cycle growing, 20% collapsing — roughly the real asymmetry.
    const fraction = p < 0.8 ? 0.4 + (p / 0.8) * 0.6 : 1 - ((p - 0.8) / 0.2) * 0.6
    const rings = Math.max(2, Math.floor(TUBULAR_SEGMENTS * fraction))
    mesh.geometry.setDrawRange(0, Math.min(total, rings * INDICES_PER_SEGMENT))
  })

  return <mesh ref={ref} geometry={geometry} material={mat} raycast={() => null} />
}

function Microtubules() {
  return (
    <Highlightable id="microtubule">
      {MICROTUBULES.map((spec, i) => (
        <Microtubule key={i} spec={spec} index={i} />
      ))}
    </Highlightable>
  )
}

/**
 * Cortical actin: a fine, dense mesh pressed against the inside of the plasma
 * membrane. Merged into a single geometry — there are ninety of them and they
 * do not need individual behaviour.
 */
function ActinCortex() {
  const geometry = useMemo(() => {
    const parts = ACTIN_FILAMENTS.map((f) =>
      tubeGeometry([f.a, f.c, f.b], 0.022, 24, 5),
    )
    const merged = BufferGeometryUtils.mergeGeometries(parts, false)
    parts.forEach((p) => p.dispose())
    return merged
  }, [])

  const mat = useSolidMaterial(palette.actin, { emissive: 0.22, opacity: 0.5 })
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const m = ref.current
    if (!m) return
    // The cortex flexes with the membrane it is attached to.
    const t = state.clock.elapsedTime
    m.scale.setScalar(1 + Math.sin(t * 0.5) * 0.004)
  })

  return (
    <Highlightable id="actin">
      <mesh ref={ref} geometry={geometry} material={mat} raycast={() => null} />
    </Highlightable>
  )
}

/** A centriole: nine microtubule triplets arranged in a barrel. */
function centrioleGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    for (let k = 0; k < 3; k++) {
      const r = 0.2 + k * 0.035
      const tube = new THREE.CylinderGeometry(0.024, 0.024, 0.44, 6)
      // Triplets are tilted tangentially, giving the classic pinwheel.
      tube.rotateZ(0.32)
      tube.translate(Math.cos(a + k * 0.06) * r, 0, Math.sin(a + k * 0.06) * r)
      parts.push(tube)
    }
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  merged.computeVertexNormals()
  return merged
}

function Centrosome() {
  const geo = useMemo(centrioleGeometry, [])
  const mat = useSolidMaterial(palette.centrosome.base, { emissive: 0.35 })
  const cloudMat = useMembraneMaterial({
    base: palette.centrosome.base,
    rim: palette.centrosome.rim,
    opacity: 0.09,
    rimStrength: 0.3,
    emissive: 0.4,
  })
  const cloudGeo = useMemo(() => new THREE.SphereGeometry(0.62, 20, 16), [])
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    ;(cloudMat as MembraneMaterial).time = state.clock.elapsedTime
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.05
  })

  return (
    <Highlightable id="centrosome">
      <group ref={group} position={CENTROSOME.center}>
        <mesh geometry={cloudGeo} material={cloudMat} raycast={() => null} />
        {/* The two centrioles sit at right angles to each other. */}
        <mesh geometry={geo} material={mat} position={[-0.12, 0, 0]} />
        <mesh geometry={geo} material={mat} position={[0.16, 0.05, 0.1]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </Highlightable>
  )
}

export function Cytoskeleton() {
  return (
    <>
      <Microtubules />
      <ActinCortex />
      <Centrosome />
    </>
  )
}
