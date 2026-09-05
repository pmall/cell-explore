import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { CELL_RADIUS, ER_EXIT_SITE, GOLGI } from '../../data/layout'
import { cellTime, smooth } from '../clock'
import { MechanismGroup, proteinGeometry } from './common'

/**
 * A protein's journey out of the cell. One continuous path stands in for four
 * separate budding-and-fusion events, because what a beginner needs to see is
 * the route and the order, not the machinery of each hop.
 *
 * The cargo changes colour as it crosses the Golgi: that is the sugar-chain
 * remodelling which both matures the protein and tells the cell where to send it.
 */

const PERIOD = 34
const CARRIERS = 3

/** Half the height of the Golgi stack, along its own axis. */
const STACK_HALF = ((GOLGI.cisternae - 1) / 2) * 0.34
const CIS = GOLGI.center.clone().addScaledVector(GOLGI.axis, -STACK_HALF - 0.45)
const TRANS = GOLGI.center.clone().addScaledVector(GOLGI.axis, STACK_HALF + 0.45)
const EXIT_DIR = new THREE.Vector3(0.5, -0.5, 0.71).normalize()
const SURFACE = EXIT_DIR.clone().multiplyScalar(CELL_RADIUS * 0.985)

export function SecretoryPathway() {
  const path = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          ER_EXIT_SITE.clone(),
          ER_EXIT_SITE.clone().lerp(CIS, 0.5).add(new THREE.Vector3(0, 0.35, 0)),
          CIS.clone(),
          GOLGI.center.clone().addScaledVector(GOLGI.axis, -STACK_HALF * 0.4),
          GOLGI.center.clone().addScaledVector(GOLGI.axis, STACK_HALF * 0.4),
          TRANS.clone(),
          TRANS.clone().lerp(SURFACE, 0.45).add(new THREE.Vector3(0.2, -0.3, 0.2)),
          SURFACE.clone(),
        ],
        false,
        'centripetal',
        0.5,
      ),
    [],
  )

  const vesicleGeo = useMemo(() => new THREE.IcosahedronGeometry(0.2, 3), [])
  const cargoGeo = useMemo(() => proteinGeometry(0.1, 6), [])
  const coatGeo = useMemo(() => new THREE.TetrahedronGeometry(0.045), [])

  const vesicleMat = useSolidMaterial(palette.vesicle.base, { emissive: 0.6, opacity: 0.5 })
  const cargoMat = useSolidMaterial(palette.protein.base, { emissive: 0.7 })
  const coatMat = useSolidMaterial(palette.coatedVesicle.base, { emissive: 0.7 })
  const burstMat = useSolidMaterial(palette.glycoprotein.base, { emissive: 0.9, opacity: 0.9 })

  const vesicles = useRef<THREE.InstancedMesh>(null)
  const cargos = useRef<THREE.InstancedMesh>(null)
  const coats = useRef<THREE.InstancedMesh>(null)
  const burst = useRef<THREE.InstancedMesh>(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colour = useMemo(() => new THREE.Color(), [])
  const immature = useMemo(() => new THREE.Color(palette.protein.base), [])
  const mature = useMemo(() => new THREE.Color(palette.glycoprotein.base), [])

  const COATS_PER = 6

  useFrame(() => {
    const t = cellTime()
    const at = new THREE.Vector3()

    for (let i = 0; i < CARRIERS; i++) {
      const p = ((t / PERIOD + i / CARRIERS) % 1 + 1) % 1
      path.getPointAt(p, at)

      // Vesicles pinch off, swell slightly in transit, then flatten into the
      // target membrane as they fuse.
      const bud = smooth(Math.min(1, p / 0.06))
      const fuse = p > 0.94 ? 1 - smooth((p - 0.94) / 0.06) : 1
      const size = bud * fuse

      if (vesicles.current) {
        dummy.position.copy(at)
        dummy.rotation.set(t * 0.5 + i, t * 0.3 + i, 0)
        dummy.scale.setScalar(size * (0.9 + 0.1 * Math.sin(t * 3 + i)))
        dummy.updateMatrix()
        vesicles.current.setMatrixAt(i, dummy.matrix)
      }

      if (cargos.current) {
        dummy.position.copy(at)
        dummy.rotation.set(t * 0.9 + i, t * 0.6 + i, 0)
        // Cargo survives the fusion — it is released, not destroyed.
        dummy.scale.setScalar(bud * (p > 0.94 ? 1 : 1))
        dummy.updateMatrix()
        cargos.current.setMatrixAt(i, dummy.matrix)
        // Glycosylation happens in the Golgi: roughly the middle of the route.
        colour.copy(immature).lerp(mature, smooth(Math.max(0, Math.min(1, (p - 0.28) / 0.34))))
        cargos.current.setColorAt(i, colour)
      }

      // COPII / COPI coats: present only while the vesicle is budding or docking.
      if (coats.current) {
        const coated = p < 0.16 ? 1 - p / 0.16 : p > 0.62 && p < 0.78 ? 1 : 0
        for (let c = 0; c < COATS_PER; c++) {
          const a = (c / COATS_PER) * Math.PI * 2 + t * 1.2
          const tilt = Math.sin(c * 2.4 + i) * 0.7
          dummy.position
            .copy(at)
            .add(
              new THREE.Vector3(
                Math.cos(a) * 0.24,
                Math.sin(tilt) * 0.24,
                Math.sin(a) * 0.24,
              ),
            )
          dummy.rotation.set(a, tilt, 0)
          dummy.scale.setScalar(coated * size)
          dummy.updateMatrix()
          coats.current.setMatrixAt(i * COATS_PER + c, dummy.matrix)
        }
      }
    }

    if (vesicles.current) vesicles.current.instanceMatrix.needsUpdate = true
    if (cargos.current) {
      cargos.current.instanceMatrix.needsUpdate = true
      if (cargos.current.instanceColor) cargos.current.instanceColor.needsUpdate = true
    }
    if (coats.current) coats.current.instanceMatrix.needsUpdate = true

    // Exocytosis: released cargo spreads outward from the fusion site.
    if (burst.current) {
      for (let i = 0; i < 10; i++) {
        const sub = ((t / PERIOD) * CARRIERS + i * 0.031) % 1
        const out = sub > 0.94 ? (sub - 0.94) / 0.06 : -1
        if (out < 0) {
          dummy.scale.setScalar(0)
        } else {
          const a = i * 2.4
          dummy.position
            .copy(SURFACE)
            .addScaledVector(EXIT_DIR, out * 1.1)
            .add(new THREE.Vector3(Math.cos(a), Math.sin(a * 1.7), Math.sin(a)).multiplyScalar(out * 0.5))
          dummy.rotation.set(a, a * 1.3, 0)
          dummy.scale.setScalar((1 - out) * 0.7)
        }
        dummy.updateMatrix()
        burst.current.setMatrixAt(i, dummy.matrix)
      }
      burst.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <MechanismGroup id="secretory">
      <instancedMesh ref={vesicles} args={[vesicleGeo, vesicleMat, CARRIERS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={cargos} args={[cargoGeo, cargoMat, CARRIERS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={coats} args={[coatGeo, coatMat, CARRIERS * COATS_PER]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={burst} args={[cargoGeo, burstMat, 10]} frustumCulled={false} raycast={() => null} />
    </MechanismGroup>
  )
}
