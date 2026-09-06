import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BufferGeometryUtils, orientToDirection } from '../../lib/geometry'
import { useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { CELL_RADIUS, MEMBRANE_PROTEINS } from '../../data/layout'
import { Highlightable } from '../Highlightable'
import { cellTime } from '../clock'

/**
 * Half the mass of a membrane is protein. Three shapes stand in for the three
 * jobs: receptors (stalk + binding head, sticking out), channels (open barrels
 * spanning the bilayer) and pumps (fatter, closed barrels).
 */

function receptorGeometry() {
  const stalk = new THREE.CylinderGeometry(0.022, 0.032, 0.2, 6)
  const head = new THREE.SphereGeometry(0.055, 8, 6)
  head.translate(0, 0.125, 0)
  const foot = new THREE.SphereGeometry(0.04, 6, 5)
  foot.translate(0, -0.105, 0)
  const g = BufferGeometryUtils.mergeGeometries([stalk, head, foot], false)
  stalk.dispose(); head.dispose(); foot.dispose()
  g.computeVertexNormals()
  return g
}

function channelGeometry() {
  const g = new THREE.CylinderGeometry(0.055, 0.055, 0.17, 8, 1, true)
  g.computeVertexNormals()
  return g
}

function pumpGeometry() {
  const body = new THREE.CylinderGeometry(0.06, 0.08, 0.19, 8)
  const cap = new THREE.SphereGeometry(0.062, 8, 6)
  cap.scale(1, 0.6, 1)
  cap.translate(0, 0.1, 0)
  const g = BufferGeometryUtils.mergeGeometries([body, cap], false)
  body.dispose(); cap.dispose()
  g.computeVertexNormals()
  return g
}

type Kind = 'receptor' | 'channel' | 'pump'

function ProteinSet({ kind, geometry, color }: { kind: Kind; geometry: THREE.BufferGeometry; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = useSolidMaterial(color, { emissive: 0.3 })
  const items = useMemo(() => MEMBRANE_PROTEINS.filter((p) => p.kind === kind), [kind])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((item, i) => {
      dummy.position.copy(item.dir).multiplyScalar(CELL_RADIUS * 0.985)
      dummy.quaternion.copy(orientToDirection(item.dir))
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [items, dummy])

  // Membrane proteins are not nailed down — they drift laterally through the
  // bilayer. A slow bob is a cheap way to say "this thing is floating".
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = cellTime()
    items.forEach((item, i) => {
      const bob = Math.sin(t * 0.4 + item.phase) * 0.03
      dummy.position.copy(item.dir).multiplyScalar(CELL_RADIUS * 0.985 + bob)
      dummy.quaternion.copy(orientToDirection(item.dir))
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />
}

export function MembraneProteins() {
  const receptor = useMemo(receptorGeometry, [])
  const channel = useMemo(channelGeometry, [])
  const pump = useMemo(pumpGeometry, [])

  return (
    <Highlightable id="membraneProteins">
      <ProteinSet kind="receptor" geometry={receptor} color={palette.receptor} />
      <ProteinSet kind="channel" geometry={channel} color={palette.membrane.rim} />
      <ProteinSet kind="pump" geometry={pump} color={palette.glycoprotein.base} />
    </Highlightable>
  )
}
