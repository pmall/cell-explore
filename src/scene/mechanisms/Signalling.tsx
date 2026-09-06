import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BufferGeometryUtils, orientToDirection } from '../../lib/geometry'
import { useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { CELL_RADIUS, LYSOSOMES, SIGNAL_RECEPTOR_DIR } from '../../data/layout'
import { Nameable } from '../Nameable'
import { instanceSphereRaycast } from '../picking'
import { cellTime, smooth } from '../clock'
import { MechanismGroup, proteinGeometry } from './common'

/**
 * Two things happen at the cell surface, and they are easy to confuse:
 *
 *  - Signalling: the message never crosses the membrane. A ligand binds outside,
 *    the receptor changes shape, and a *different* molecule carries the news
 *    onward inside — amplifying hugely at each relay.
 *  - Endocytosis: here the outside really does come in, wrapped in a piece of
 *    membrane, and is delivered to a lysosome.
 */

const SIGNAL_PERIOD = 18
const ENDO_PERIOD = 26

const RECEPTOR_POS = SIGNAL_RECEPTOR_DIR.clone().multiplyScalar(CELL_RADIUS * 0.99)
const RECEPTOR_QUAT = orientToDirection(SIGNAL_RECEPTOR_DIR)
const INWARD = SIGNAL_RECEPTOR_DIR.clone().negate()

const ENDO_DIR = new THREE.Vector3(-0.62, -0.34, 0.42).normalize()
const ENDO_START = ENDO_DIR.clone().multiplyScalar(CELL_RADIUS * 0.98)

const CASCADE = 22

const RELAY_PICK = instanceSphereRaycast(0.12)
const CLATHRIN_PICK = instanceSphereRaycast(0.12)

export function Signalling() {
  const receptorGeo = useMemo(() => {
    // Deliberately oversized versus the background membrane proteins: this is
    // the one the tour talks about, so it has to be findable.
    const outer = new THREE.SphereGeometry(0.16, 12, 10)
    outer.scale(1, 0.8, 1)
    outer.translate(0, 0.3, 0)
    const stalk = new THREE.CylinderGeometry(0.07, 0.09, 0.42, 10)
    const inner = new THREE.SphereGeometry(0.12, 10, 8)
    inner.translate(0, -0.26, 0)
    const g = BufferGeometryUtils.mergeGeometries([outer, stalk, inner], false)
    outer.dispose(); stalk.dispose(); inner.dispose()
    g.computeVertexNormals()
    return g
  }, [])

  const ligandGeo = useMemo(() => proteinGeometry(0.075, 11), [])
  const relayGeo = useMemo(() => new THREE.OctahedronGeometry(0.055), [])
  const vesicleGeo = useMemo(() => new THREE.IcosahedronGeometry(0.24, 2), [])
  const clathrinGeo = useMemo(() => new THREE.TetrahedronGeometry(0.06), [])

  const receptorMat = useSolidMaterial(palette.receptor, { emissive: 0.55 })
  const ligandMat = useSolidMaterial(palette.ligand, { emissive: 0.9 })
  const relayMat = useSolidMaterial(palette.secondMessenger, { emissive: 0.9 })
  const vesicleMat = useSolidMaterial(palette.coatedVesicle.base, { emissive: 0.5, opacity: 0.65 })
  const clathrinMat = useSolidMaterial(palette.coatedVesicle.rim, { emissive: 0.8 })

  const receptor = useRef<THREE.Mesh>(null)
  const ligand = useRef<THREE.Mesh>(null)
  const relays = useRef<THREE.InstancedMesh>(null)
  const vesicle = useRef<THREE.Mesh>(null)
  const clathrin = useRef<THREE.InstancedMesh>(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const endoPath = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          ENDO_START.clone(),
          ENDO_START.clone().multiplyScalar(0.86),
          ENDO_START.clone().multiplyScalar(0.6).lerp(LYSOSOMES[0].position, 0.35),
          LYSOSOMES[0].position.clone(),
        ],
        false,
        'centripetal',
        0.5,
      ),
    [],
  )
  const at = useMemo(() => new THREE.Vector3(), [])

  const CLATHRIN_COUNT = 10

  useFrame(() => {
    const t = cellTime()
    const p = ((t / SIGNAL_PERIOD) % 1 + 1) % 1

    // 0.00-0.35 approach · 0.35-0.55 bound · 0.55-1.00 released and drifting off
    const approach = smooth(Math.min(1, p / 0.35))
    const bound = p >= 0.35 && p < 0.55

    if (ligand.current) {
      const away = SIGNAL_RECEPTOR_DIR.clone().multiplyScalar(1.9)
      const wobble = new THREE.Vector3(
        Math.sin(t * 1.3) * 0.25,
        Math.cos(t * 1.1) * 0.25,
        Math.sin(t * 0.9) * 0.25,
      )
      if (p < 0.55) {
        ligand.current.position
          .copy(RECEPTOR_POS)
          .addScaledVector(SIGNAL_RECEPTOR_DIR, 0.42)
          .add(away.multiplyScalar(1 - approach))
          .add(wobble.multiplyScalar(1 - approach))
      } else {
        const leave = (p - 0.55) / 0.45
        ligand.current.position
          .copy(RECEPTOR_POS)
          .addScaledVector(SIGNAL_RECEPTOR_DIR, 0.42 + leave * 2.4)
          .add(wobble.multiplyScalar(leave))
      }
      ligand.current.rotation.set(t, t * 0.7, 0)
      ligand.current.scale.setScalar(p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.45))
    }

    if (receptor.current) {
      // Binding twists the receptor: that shape change *is* the signal crossing.
      const twist = bound ? smooth(Math.min(1, (p - 0.35) / 0.08)) : 0
      receptor.current.quaternion.copy(RECEPTOR_QUAT)
      receptor.current.rotateY(twist * 0.9 + Math.sin(t * 8) * 0.04 * twist)
      receptor.current.scale.setScalar(1 + twist * 0.12)
    }

    // Amplification: one bound receptor, then a widening cone of messengers.
    if (relays.current) {
      for (let i = 0; i < CASCADE; i++) {
        const stage = i < 3 ? 0 : i < 9 ? 1 : 2
        const delay = 0.36 + stage * 0.06
        const sub = (p - delay) / 0.42
        if (sub < 0 || sub > 1) {
          dummy.scale.setScalar(0)
        } else {
          const spread = 0.35 + stage * 0.7
          const a = i * 2.399
          const perp1 = new THREE.Vector3(0, 1, 0).cross(SIGNAL_RECEPTOR_DIR).normalize()
          const perp2 = new THREE.Vector3().crossVectors(SIGNAL_RECEPTOR_DIR, perp1)
          dummy.position
            .copy(RECEPTOR_POS)
            .addScaledVector(INWARD, 0.3 + sub * (1.6 + stage * 1.4))
            .addScaledVector(perp1, Math.cos(a) * spread * sub)
            .addScaledVector(perp2, Math.sin(a) * spread * sub)
          dummy.rotation.set(t * 2 + a, t * 1.4, 0)
          dummy.scale.setScalar(Math.min(1, sub * 5) * (1 - sub * 0.7))
        }
        dummy.updateMatrix()
        relays.current.setMatrixAt(i, dummy.matrix)
      }
      relays.current.instanceMatrix.needsUpdate = true
    }

    // ── endocytosis, on its own slower cycle ─────────────────────────────────
    const e = ((t / ENDO_PERIOD) % 1 + 1) % 1
    // 0.00-0.25 the pit invaginates · 0.25-0.85 travels inward · then fuses
    const pit = smooth(Math.min(1, e / 0.25))
    const travel = e < 0.25 ? 0 : Math.min(1, (e - 0.25) / 0.6)
    const arriving = e > 0.85 ? 1 - (e - 0.85) / 0.15 : 1

    if (vesicle.current) {
      endoPath.getPointAt(travel * 0.999, at)
      // Before it pinches off the vesicle is still a dimple in the surface.
      vesicle.current.position.copy(e < 0.25 ? ENDO_START.clone().multiplyScalar(1 - pit * 0.04) : at)
      vesicle.current.scale.setScalar(pit * arriving * 0.95)
      vesicle.current.rotation.set(t * 0.4, t * 0.3, 0)
    }

    if (clathrin.current) {
      // The clathrin coat assembles to bend the membrane, then falls away once
      // the vesicle is free — it has done its job.
      const coated = e < 0.25 ? pit : Math.max(0, 1 - (e - 0.25) / 0.18)
      const centre = vesicle.current?.position ?? ENDO_START
      for (let i = 0; i < CLATHRIN_COUNT; i++) {
        const a = (i / CLATHRIN_COUNT) * Math.PI * 2
        const tilt = Math.sin(i * 1.9) * 0.9
        dummy.position
          .copy(centre)
          .add(new THREE.Vector3(Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt)).multiplyScalar(0.28))
        dummy.rotation.set(a, tilt, t)
        dummy.scale.setScalar(coated * 0.9)
        dummy.updateMatrix()
        clathrin.current.setMatrixAt(i, dummy.matrix)
      }
      clathrin.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <MechanismGroup id="signalling">
      <Nameable id="signalReceptor">
        <mesh ref={receptor} geometry={receptorGeo} material={receptorMat} position={RECEPTOR_POS} />
      </Nameable>
      <Nameable id="ligand">
        <mesh ref={ligand} geometry={ligandGeo} material={ligandMat} />
      </Nameable>
      <Nameable id="secondMessenger">
        <instancedMesh ref={relays} args={[relayGeo, relayMat, CASCADE]} frustumCulled={false} raycast={RELAY_PICK} />
      </Nameable>
      <Nameable id="endocyticVesicle">
        <mesh ref={vesicle} geometry={vesicleGeo} material={vesicleMat} />
      </Nameable>
      <Nameable id="clathrin">
        <instancedMesh ref={clathrin} args={[clathrinGeo, clathrinMat, CLATHRIN_COUNT]} frustumCulled={false} raycast={CLATHRIN_PICK} />
      </Nameable>
    </MechanismGroup>
  )
}
