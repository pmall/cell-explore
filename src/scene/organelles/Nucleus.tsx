import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { blobGeometry, BufferGeometryUtils, orientToDirection } from '../../lib/geometry'
import { MembraneMaterial, useMembraneMaterial, useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { NUCLEAR_PORES, NUCLEOLUS, NUCLEUS } from '../../data/layout'
import { Highlightable } from '../Highlightable'

/**
 * The nuclear envelope is genuinely two membranes with a gap between them — the
 * gap is continuous with the ER lumen, which is why the ER appears to grow
 * straight out of the nucleus in this scene. Both shells are drawn.
 */

function poreGeometry() {
  // A ring of eight subunits: the nuclear pore's real eight-fold symmetry.
  const parts: THREE.BufferGeometry[] = []
  const ring = new THREE.TorusGeometry(0.2, 0.055, 8, 24)
  ring.rotateX(Math.PI / 2)
  parts.push(ring)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const sub = new THREE.SphereGeometry(0.058, 8, 6)
    sub.translate(Math.cos(a) * 0.2, 0.055, Math.sin(a) * 0.2)
    parts.push(sub)
  }
  // Cytoplasmic filaments reaching out to catch cargo.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    const fil = new THREE.CylinderGeometry(0.012, 0.02, 0.16, 5)
    fil.translate(0, 0.11, 0)
    fil.rotateZ(Math.cos(a) * 0.5)
    fil.rotateX(Math.sin(a) * 0.5)
    fil.translate(Math.cos(a) * 0.19, 0.03, Math.sin(a) * 0.19)
    parts.push(fil)
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  merged.computeVertexNormals()
  return merged
}

function NuclearPores() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(poreGeometry, [])
  const material = useSolidMaterial(palette.nuclearPore, { emissive: 0.35 })
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    NUCLEAR_PORES.forEach((dir, i) => {
      dummy.position.copy(dir).multiplyScalar(NUCLEUS.radius * 1.0)
      dummy.quaternion.copy(orientToDirection(dir))
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <Highlightable id="nuclearPore">
      <instancedMesh ref={ref} args={[geometry, material, NUCLEAR_PORES.length]} frustumCulled={false} />
    </Highlightable>
  )
}

function Nucleolus() {
  const geo = useMemo(() => blobGeometry(NUCLEOLUS.radius, 14, 0.16, 2.2, 42), [])
  const inner = useMemo(() => blobGeometry(NUCLEOLUS.radius * 0.62, 10, 0.22, 3.4, 77), [])
  const mat = useMembraneMaterial({
    base: palette.nucleolus.base,
    rim: palette.nucleolus.rim,
    opacity: 0.46,
    rimStrength: 0.5,
    emissive: 0.4,
    side: THREE.FrontSide,
    wobble: 0.03,
    wobbleFreq: 2.2,
  })
  const innerMat = useMembraneMaterial({
    base: palette.nucleolus.rim,
    rim: palette.nucleolus.rim,
    opacity: 0.36,
    rimStrength: 0.5,
    emissive: 0.75,
  })

  useFrame((state) => {
    // A nucleolus has no membrane: it is a liquid droplet. Let it jiggle.
    mat.time = state.clock.elapsedTime
    innerMat.time = state.clock.elapsedTime
  })

  return (
    <Highlightable id="nucleolus">
      <group position={NUCLEOLUS.center.clone().sub(NUCLEUS.center)}>
        <mesh geometry={geo} material={mat} />
        <mesh geometry={inner} material={innerMat} raycast={() => null} />
      </group>
    </Highlightable>
  )
}

export function Nucleus({ children }: { children?: React.ReactNode }) {
  const outerGeo = useMemo(() => blobGeometry(NUCLEUS.radius, 24, 0.045, 1.0, 21), [])
  const innerGeo = useMemo(
    () => blobGeometry(NUCLEUS.radius - NUCLEUS.envelopeGap, 20, 0.045, 1.0, 21),
    [],
  )
  const nucleoplasmGeo = useMemo(
    () => blobGeometry(NUCLEUS.radius - NUCLEUS.envelopeGap * 2.2, 16, 0.045, 1.0, 21),
    [],
  )

  const outerMat = useMembraneMaterial({
    base: palette.nucleus.base,
    rim: palette.nucleus.rim,
    opacity: 0.13,
    rimStrength: 0.7,
    rimPower: 2.2,
    emissive: 0.42,
    side: THREE.FrontSide,
    wobble: 0.02,
    wobbleFreq: 1.6,
  })
  const innerMat = useMembraneMaterial({
    base: palette.nucleus.base,
    rim: palette.nucleus.rim,
    opacity: 0.08,
    rimStrength: 0.36,
    rimPower: 2.8,
    emissive: 0.22,
    side: THREE.BackSide,
    wobble: 0.02,
    wobbleFreq: 1.6,
  })
  const nucleoplasmMat = useMembraneMaterial({
    base: palette.nucleus.base,
    rim: palette.nucleus.rim,
    opacity: 0.05,
    rimStrength: 0.12,
    rimPower: 1.4,
    emissive: 0.08,
    side: THREE.BackSide,
  })

  useFrame((state) => {
    const t = state.clock.elapsedTime
    ;[outerMat, innerMat, nucleoplasmMat].forEach((m) => ((m as MembraneMaterial).time = t))
  })

  return (
    <group position={NUCLEUS.center}>
      <Highlightable id="nucleus">
        <mesh geometry={outerGeo} material={outerMat} renderOrder={1} />
        <mesh geometry={innerGeo} material={innerMat} renderOrder={1} raycast={() => null} />
        <mesh geometry={nucleoplasmGeo} material={nucleoplasmMat} renderOrder={0} raycast={() => null} />
      </Highlightable>
      <NuclearPores />
      <Nucleolus />
      {children}
    </group>
  )
}
