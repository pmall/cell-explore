import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BufferGeometryUtils } from '../../lib/geometry'
import { useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import {
  FEATURED_MITOCHONDRION,
  MITOCHONDRIA,
  MITO_PROTON_LOOP,
  MITO_SYNTHASE_LOCAL,
} from '../../data/layout'
import { mitochondrionTransform } from '../organelles/Mitochondria'
import { Nameable } from '../Nameable'
import { instanceSphereRaycast } from '../picking'
import { cellTime } from '../clock'
import { MechanismGroup } from './common'

/**
 * Chemiosmosis, the idea that won Peter Mitchell a Nobel Prize: the electron
 * transport chain does not make ATP directly. It pumps protons across a
 * membrane, and the gradient does the work when they fall back through.
 *
 * The proton loop here is a single closed curve — out of the matrix at the
 * complexes, along the intermembrane space, back down through ATP synthase.
 * That closed circuit *is* the mechanism, so it is drawn literally.
 */

const HOST_INDEX = FEATURED_MITOCHONDRION
const HOST = MITOCHONDRIA[HOST_INDEX]
const PROTONS = 16
const ATP_COUNT = 7

// These live inside a mitochondrion scaled down by its own placement, so the
// targets are generous in the local space they are tested in.
const PROTON_PICK = instanceSphereRaycast(0.1)
const ATP_PICK = instanceSphereRaycast(0.16)

export function Bioenergetics() {
  // Local space of the mitochondrion: long axis is Y, radius ~0.52.
  const protonLoop = useMemo(
    () => new THREE.CatmullRomCurve3(MITO_PROTON_LOOP, true, 'centripetal', 0.5),
    [],
  )

  /** Three ETC complexes, seated where the loop crosses the inner membrane. */
  const complexPositions = useMemo(
    () => [0.1, 0.16, 0.22].map((u) => protonLoop.getPointAt(u)),
    [protonLoop],
  )
  const synthasePosition = MITO_SYNTHASE_LOCAL

  const protonGeo = useMemo(() => new THREE.SphereGeometry(0.035, 6, 5), [])
  const atpGeo = useMemo(() => new THREE.TetrahedronGeometry(0.075), [])
  const complexGeo = useMemo(() => {
    const body = new THREE.CylinderGeometry(0.075, 0.095, 0.2, 8)
    const top = new THREE.SphereGeometry(0.075, 8, 6)
    top.scale(1, 0.55, 1)
    top.translate(0, 0.11, 0)
    const g = BufferGeometryUtils.mergeGeometries([body, top], false)
    body.dispose(); top.dispose()
    g.computeVertexNormals()
    return g
  }, [])
  const synthaseStatorGeo = useMemo(() => new THREE.CylinderGeometry(0.05, 0.07, 0.2, 8), [])
  const synthaseHeadGeo = useMemo(() => {
    // The F1 head is six subunits in a ring around a central shaft.
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const lobe = new THREE.SphereGeometry(0.06, 8, 6)
      lobe.translate(Math.cos(a) * 0.085, 0, Math.sin(a) * 0.085)
      parts.push(lobe)
    }
    const shaft = new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6)
    shaft.translate(0, -0.11, 0)
    parts.push(shaft)
    const g = BufferGeometryUtils.mergeGeometries(parts, false)
    parts.forEach((p) => p.dispose())
    g.computeVertexNormals()
    return g
  }, [])

  const protonMat = useSolidMaterial(palette.proton, { emissive: 1.0 })
  const atpMat = useSolidMaterial(palette.atp, { emissive: 1.0 })
  const complexMat = useSolidMaterial(palette.etc, { emissive: 0.45 })
  const synthaseMat = useSolidMaterial(palette.atpSynthase, { emissive: 0.7 })

  const host = useRef<THREE.Group>(null)
  const protons = useRef<THREE.InstancedMesh>(null)
  const atp = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const at = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const t = cellTime()

    // Ride along with the mitochondrion, which is itself drifting.
    if (host.current) mitochondrionTransform(HOST, HOST_INDEX, t, host.current)

    if (protons.current) {
      for (let i = 0; i < PROTONS; i++) {
        const p = ((t * 0.07 + i / PROTONS) % 1 + 1) % 1
        protonLoop.getPointAt(p, at)
        dummy.position.copy(at)
        // Protons are small and jittery — thermal motion dominates at this scale.
        dummy.position.x += Math.sin(t * 6 + i) * 0.012
        dummy.position.z += Math.cos(t * 5 + i * 1.7) * 0.012
        // They bunch up in the intermembrane space, which is the whole point:
        // that crowding is the stored energy.
        const crowded = p > 0.28 && p < 0.55 ? 1.5 : 1
        dummy.scale.setScalar(crowded)
        dummy.updateMatrix()
        protons.current.setMatrixAt(i, dummy.matrix)
      }
      protons.current.instanceMatrix.needsUpdate = true
    }

    // One full rotation of the rotor yields three ATP.
    if (head.current) head.current.rotation.y = t * 2.4

    if (atp.current) {
      for (let i = 0; i < ATP_COUNT; i++) {
        const p = ((t * 0.16 + i / ATP_COUNT) % 1 + 1) % 1
        const a = i * 2.4
        dummy.position
          .copy(synthasePosition)
          .add(
            new THREE.Vector3(
              Math.cos(a) * 0.35,
              -0.2 - p * 1.4,
              Math.sin(a) * 0.35,
            ).multiplyScalar(0.4 + p),
          )
        dummy.rotation.set(t * 2 + a, t * 1.5, 0)
        // Fade in on release, fade out as it diffuses away into the cytosol.
        dummy.scale.setScalar(Math.min(1, p * 6) * (1 - p) * 1.4)
        dummy.updateMatrix()
        atp.current.setMatrixAt(i, dummy.matrix)
      }
      atp.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <MechanismGroup id="bioenergetics">
      <group ref={host}>
        <group scale={HOST.scale}>
          <Nameable id="etcComplex">
            {complexPositions.map((p, i) => (
              <mesh key={i} geometry={complexGeo} material={complexMat} position={p} />
            ))}
          </Nameable>
          <Nameable id="atpSynthase">
            <mesh geometry={synthaseStatorGeo} material={synthaseMat} position={synthasePosition} />
            <mesh
              ref={head}
              geometry={synthaseHeadGeo}
              material={synthaseMat}
              position={[synthasePosition.x, synthasePosition.y - 0.19, synthasePosition.z]}
            />
          </Nameable>
          <Nameable id="proton">
            <instancedMesh ref={protons} args={[protonGeo, protonMat, PROTONS]} frustumCulled={false} raycast={PROTON_PICK} />
          </Nameable>
          <Nameable id="atp">
            <instancedMesh ref={atp} args={[atpGeo, atpMat, ATP_COUNT]} frustumCulled={false} raycast={ATP_PICK} />
          </Nameable>
        </group>
      </group>
    </MechanismGroup>
  )
}
