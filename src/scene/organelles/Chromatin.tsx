import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { tubeGeometry } from '../../lib/geometry'
import { useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { ACTIVE_GENE, CHROMATIN, NUCLEUS } from '../../data/layout'
import { Rng } from '../../lib/rng'
import { Highlightable } from '../Highlightable'

/** B-DNA proportions, scaled up: 10.5 base pairs per turn, rise 0.34 nm. */
const BP_PER_TURN = 10.5
const BP_RISE = 0.085
const HELIX_RADIUS = 0.26
/** Offset between the two strands — this is what creates the major/minor grooves. */
const STRAND_OFFSET = 2.35

type HelixProps = {
  start: THREE.Vector3
  end: THREE.Vector3
  /**
   * Position of the transcription bubble, 0-1 along the gene; base pairs near it
   * are unwound. Passed as a ref rather than a prop because it moves every
   * frame, and re-rendering the helix 60 times a second would be absurd.
   */
  bubbleRef?: { current: number | null }
  bubbleWidth?: number
}

/**
 * A real double helix: two antiparallel backbones with base pairs rung-laddered
 * between them, coloured by base. The strands are offset by 2.35 radians rather
 * than exactly pi, which is why one groove looks wider than the other.
 */
export function DoubleHelix({ start, end, bubbleRef, bubbleWidth = 0.16 }: HelixProps) {
  const frame = useMemo(() => {
    const axis = end.clone().sub(start)
    const length = axis.length()
    const dir = axis.clone().normalize()
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const u = new THREE.Vector3().crossVectors(dir, up).normalize()
    const v = new THREE.Vector3().crossVectors(dir, u).normalize()
    const basePairs = Math.max(6, Math.floor(length / BP_RISE))
    return { dir, u, v, length, basePairs }
  }, [start, end])

  const pointOn = useMemo(
    () => (i: number, strandOffset: number) => {
      const t = i / frame.basePairs
      const theta = (i / BP_PER_TURN) * Math.PI * 2 + strandOffset
      return start
        .clone()
        .addScaledVector(frame.dir, t * frame.length)
        .addScaledVector(frame.u, Math.cos(theta) * HELIX_RADIUS)
        .addScaledVector(frame.v, Math.sin(theta) * HELIX_RADIUS)
    },
    [start, frame],
  )

  const strandA = useMemo(() => {
    const pts = Array.from({ length: frame.basePairs + 1 }, (_, i) => pointOn(i, 0))
    return tubeGeometry(pts, 0.045, frame.basePairs * 3, 7)
  }, [frame, pointOn])

  const strandB = useMemo(() => {
    const pts = Array.from({ length: frame.basePairs + 1 }, (_, i) => pointOn(i, STRAND_OFFSET))
    return tubeGeometry(pts, 0.045, frame.basePairs * 3, 7)
  }, [frame, pointOn])

  const backboneMat = useSolidMaterial(palette.dnaBackbone, { emissive: 0.28 })
  // No emissive on the rungs. Per-instance colours tint the diffuse term only,
  // so a white emissive glow sits on top of all four bases equally and washes
  // them towards the same pale nothing — which is why they never read as four
  // distinct letters however far apart the palette put them.
  const rungMat = useSolidMaterial('#ffffff', { emissive: 0 })

  // A fixed, arbitrary sequence — but a consistent one, and A:T / G:C respected.
  const sequence = useMemo(() => {
    const rng = new Rng(4242)
    const bases = ['A', 'T', 'G', 'C'] as const
    return Array.from({ length: frame.basePairs }, () => rng.pick(bases))
  }, [frame.basePairs])

  const rungsRef = useRef<THREE.InstancedMesh>(null)
  const rungGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.028, 0.028, 1, 6)
    return g
  }, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = rungsRef.current
    if (!mesh) return
    const color = new THREE.Color()
    for (let i = 0; i < frame.basePairs; i++) {
      color.set(palette.dnaBases[sequence[i]])
      mesh.setColorAt(i, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [frame.basePairs, sequence])

  useFrame(() => {
    const mesh = rungsRef.current
    if (!mesh) return
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const mid = new THREE.Vector3()
    for (let i = 0; i < frame.basePairs; i++) {
      a.copy(pointOn(i, 0))
      b.copy(pointOn(i, STRAND_OFFSET))
      mid.addVectors(a, b).multiplyScalar(0.5)

      // Inside the transcription bubble the base pairs are broken apart.
      const bubble = bubbleRef?.current ?? null
      let open = 1
      if (bubble !== null) {
        const d = Math.abs(i / frame.basePairs - bubble)
        open = THREE.MathUtils.smoothstep(d, bubbleWidth * 0.35, bubbleWidth)
      }

      dummy.position.copy(mid)
      dummy.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      )
      dummy.scale.set(open, a.distanceTo(b) * open, open)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={strandA} material={backboneMat} />
      <mesh geometry={strandB} material={backboneMat} />
      <instancedMesh
        ref={rungsRef}
        args={[rungGeo, rungMat, frame.basePairs]}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  )
}

/**
 * Chromatin territories. Each chromosome stays in its own region of the nucleus
 * instead of mixing — that is really how interphase nuclei are organised.
 * Nucleosome beads ride along each fibre: DNA spooled around histone octamers.
 */
function ChromatinFibre({ strand, index }: { strand: (typeof CHROMATIN)[number]; index: number }) {
  const color = palette.chromatin[index % palette.chromatin.length]
  const geo = useMemo(() => tubeGeometry(strand.points, 0.055, 220, 7), [strand])
  const mat = useSolidMaterial(color, { emissive: 0.45, opacity: 0.95 })
  const beadMat = useSolidMaterial(color, { emissive: 0.65 })

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(strand.points, false, 'centripetal', 0.5),
    [strand],
  )
  const beadCount = 64
  const beadGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.1, 7, 5)
    g.scale(1, 0.78, 1)
    return g
  }, [])
  const beadsRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = beadsRef.current
    if (!mesh) return
    for (let i = 0; i < beadCount; i++) {
      const t = (i + 0.5) / beadCount
      dummy.position.copy(curve.getPointAt(t))
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t))
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [curve, dummy])

  return (
    <group>
      <mesh geometry={geo} material={mat} />
      <instancedMesh
        ref={beadsRef}
        args={[beadGeo, beadMat, beadCount]}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  )
}

export function Chromatin() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    // Chromatin is not static — loops jostle constantly in the nucleoplasm.
    const g = groupRef.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.rotation.y = Math.sin(t * 0.06) * 0.08
    g.rotation.x = Math.cos(t * 0.05) * 0.05
  })

  return (
    <Highlightable id="chromatin">
      <group ref={groupRef}>
        {CHROMATIN.map((strand, i) => (
          <ChromatinFibre key={i} strand={strand} index={i} />
        ))}
      </group>
    </Highlightable>
  )
}

export { ACTIVE_GENE, NUCLEUS }
