import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BufferGeometryUtils } from '../../lib/geometry'
import { useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { CENTROSOME, MICROTUBULES } from '../../data/layout'
import { cellTime } from '../clock'
import { MechanismGroup } from './common'

/**
 * Kinesin walking a microtubule. It really does walk — two motor domains
 * swinging past each other, 8 nanometres per step, one ATP per step — and
 * showing that literally is far more memorable than a vesicle sliding along.
 *
 * Cargo is towed behind, which is also true: the motor grips the microtubule at
 * the front and the vesicle at the back of a long flexible stalk.
 */

const WALKERS = [2, 9, 17, 23]
const PERIOD = 30
/** Nanometre-scale steps, exaggerated so the gait is visible from a distance. */
const STEP_RATE = 7

function motorGeometry() {
  const stalk = new THREE.CylinderGeometry(0.018, 0.018, 0.2, 5)
  stalk.translate(0, 0.1, 0)
  const g = BufferGeometryUtils.mergeGeometries([stalk], false)
  g.computeVertexNormals()
  return g
}

export function Trafficking() {
  const curves = useMemo(
    () =>
      WALKERS.map((i) => {
        const spec = MICROTUBULES[i % MICROTUBULES.length]
        return new THREE.CatmullRomCurve3(
          [CENTROSOME.center.clone(), spec.bend.clone(), spec.end.clone()],
          false,
          'centripetal',
          0.5,
        )
      }),
    [],
  )

  const footGeo = useMemo(() => new THREE.SphereGeometry(0.055, 8, 6), [])
  const stalkGeo = useMemo(motorGeometry, [])
  const cargoGeo = useMemo(() => new THREE.IcosahedronGeometry(0.19, 2), [])

  const motorMat = useSolidMaterial(palette.motorProtein, { emissive: 0.6 })
  const cargoMat = useSolidMaterial(palette.vesicle.base, { emissive: 0.45, opacity: 0.8 })

  const feet = useRef<THREE.InstancedMesh>(null)
  const stalks = useRef<THREE.InstancedMesh>(null)
  const cargos = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const at = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const behind = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const t = cellTime()

    curves.forEach((curve, w) => {
      // Alternate direction: kinesin walks outward, dynein walks back inward.
      const outward = w % 2 === 0
      const raw = ((t / PERIOD + w * 0.27) % 1 + 1) % 1
      const p = outward ? raw : 1 - raw
      // Ease off at the ends so walkers do not pop at the tubule tips.
      const visible = raw > 0.04 && raw < 0.96 ? 1 : 0

      const along = Math.min(0.985, Math.max(0.015, p))
      curve.getPointAt(along, at)
      const tangent = curve.getTangentAt(along)

      // A perpendicular, so the motor stands *on* the tubule rather than in it.
      const up = Math.abs(tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
      const side = new THREE.Vector3().crossVectors(tangent, up).normalize()
      const lift = new THREE.Vector3().crossVectors(side, tangent).normalize()

      // The two motor domains leapfrog: while one is planted, the other swings.
      const gait = (t * STEP_RATE + w) % 2
      for (let f = 0; f < 2; f++) {
        const swinging = (gait < 1 ? 0 : 1) === f
        const swing = swinging ? (gait % 1) : 0
        const lead = (f === 0 ? -0.045 : 0.045) + (swinging ? (swing - 0.5) * 0.16 : 0)
        if (feet.current) {
          dummy.position
            .copy(at)
            .addScaledVector(tangent, lead)
            .addScaledVector(lift, 0.05 + (swinging ? Math.sin(swing * Math.PI) * 0.07 : 0))
          dummy.rotation.set(0, 0, 0)
          dummy.scale.setScalar(visible)
          dummy.updateMatrix()
          feet.current.setMatrixAt(w * 2 + f, dummy.matrix)
        }
      }

      if (stalks.current) {
        dummy.position.copy(at).addScaledVector(lift, 0.07)
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lift)
        dummy.scale.setScalar(visible)
        dummy.updateMatrix()
        stalks.current.setMatrixAt(w, dummy.matrix)
      }

      if (cargos.current) {
        // Cargo trails behind the direction of travel, bobbing on its stalk.
        const trail = outward ? -1 : 1
        curve.getPointAt(Math.min(0.99, Math.max(0.01, along + trail * 0.02)), behind)
        ahead.copy(behind).addScaledVector(lift, 0.3)
        dummy.position.copy(ahead)
        dummy.position.addScaledVector(side, Math.sin(t * 2 + w) * 0.05)
        dummy.rotation.set(t * 0.4 + w, t * 0.3, 0)
        dummy.scale.setScalar(visible * 1.0)
        dummy.updateMatrix()
        cargos.current.setMatrixAt(w, dummy.matrix)
      }
    })

    if (feet.current) feet.current.instanceMatrix.needsUpdate = true
    if (stalks.current) stalks.current.instanceMatrix.needsUpdate = true
    if (cargos.current) cargos.current.instanceMatrix.needsUpdate = true
  })

  return (
    <MechanismGroup id="trafficking">
      <instancedMesh ref={feet} args={[footGeo, motorMat, WALKERS.length * 2]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={stalks} args={[stalkGeo, motorMat, WALKERS.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={cargos} args={[cargoGeo, cargoMat, WALKERS.length]} frustumCulled={false} raycast={() => null} />
    </MechanismGroup>
  )
}
