import * as THREE from 'three'
import type { StructureId } from '../data/content'

/**
 * Picking by depth is wrong in a cell. Every organelle sits behind a membrane —
 * that is what a membrane is — so the nearest hit under the cursor is almost
 * always the plasma membrane, and aiming at a mitochondrion selected the cell
 * wall instead. Nothing inside was reachable by clicking.
 *
 * So we pick by specificity rather than by distance: of everything the ray
 * passes through, the most *contained* structure wins. The plasma membrane
 * encloses the whole scene and only wins where the ray hits nothing else (the
 * rim, or open cytosol); the nuclear envelope loses to the chromatin, nucleolus
 * and pores it contains, but beats the plasma membrane. Everything else is a
 * leaf and wins outright, with ties broken by distance so the nearest of two
 * mitochondria is the one you get.
 */
const PICK_RANK: Partial<Record<StructureId, number>> = {
  plasmaMembrane: 0,
  cytosol: 0,
  nucleus: 1,
}
/** Leaf structures — contained by something, containing nothing. */
const LEAF_RANK = 2

/** Which structure an intersected mesh belongs to, if any. */
export function structureOf(object: THREE.Object3D | null): StructureId | null {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    const id = o.userData?.structureId as StructureId | undefined
    if (id) return id
  }
  return null
}

/**
 * `intersections` is the full hit list of one pointer event, sorted near to far
 * (r3f gives it to every handler). Returns the structure the viewer meant.
 */
export function resolvePick(
  intersections: readonly { object: THREE.Object3D }[],
): StructureId | null {
  let best: StructureId | null = null
  let bestRank = -1
  for (const hit of intersections) {
    const id = structureOf(hit.object)
    if (!id) continue
    const rank = PICK_RANK[id] ?? LEAF_RANK
    // Strictly greater: the list is already near-to-far, so an equal rank
    // leaves the nearer hit in place.
    if (rank > bestRank) {
      best = id
      bestRank = rank
    }
  }
  return best
}

/**
 * A cheap stand-in raycast for instanced fields of tiny bodies (ribosomes).
 *
 * Three's own InstancedMesh.raycast walks every triangle of every instance,
 * which is why these fields were made unpickable in the first place — hundreds
 * of instances on every pointer move. This tests one sphere per instance
 * instead, reading positions straight out of the instance matrices so animated
 * fields stay correct. `radius` is generous on purpose: a ribosome is a couple
 * of pixels across and needs a bigger target than its own silhouette.
 */
const _inverse = new THREE.Matrix4()
const _localRay = new THREE.Ray()
const _sphere = new THREE.Sphere()
const _centre = new THREE.Vector3()
const _point = new THREE.Vector3()

export function instanceSphereRaycast(radius: number) {
  return function raycast(
    this: THREE.InstancedMesh,
    raycaster: THREE.Raycaster,
    intersects: THREE.Intersection[],
  ) {
    const matrices = this.instanceMatrix.array
    _inverse.copy(this.matrixWorld).invert()
    _localRay.copy(raycaster.ray).applyMatrix4(_inverse)
    _localRay.direction.normalize()

    let bestDistance = Infinity
    let bestInstance = -1
    for (let i = 0; i < this.count; i++) {
      const o = i * 16
      _centre.set(matrices[o + 12], matrices[o + 13], matrices[o + 14])
      // Column length = the instance's own scale, which the free ribosomes vary.
      const scale = Math.hypot(matrices[o], matrices[o + 1], matrices[o + 2])
      _sphere.set(_centre, radius * scale)
      if (!_localRay.intersectSphere(_sphere, _point)) continue
      const d = _localRay.origin.distanceToSquared(_point)
      if (d < bestDistance) {
        bestDistance = d
        bestInstance = i
        _centre.copy(_point)
      }
    }
    if (bestInstance < 0) return

    // Report in world space: r3f sorts the hit list by this distance.
    const point = _centre.applyMatrix4(this.matrixWorld)
    intersects.push({
      distance: raycaster.ray.origin.distanceTo(point),
      point: point.clone(),
      object: this,
      instanceId: bestInstance,
    })
  }
}
