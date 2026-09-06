import * as THREE from 'three'
import { MOLECULE_BY_ID, type LabelId } from '../data/content'

/**
 * What is under the cursor, and what is allowed to be under it.
 *
 * This drives the hover tooltip only. Nothing here selects: selection comes
 * from the index in the rail, because no ray cast into a cell can say which of
 * the nested structures it crosses the viewer actually meant.
 *
 * ── which hit wins ──
 *
 * Picking by depth is wrong in a cell. Every organelle sits behind a membrane —
 * that is what a membrane is — so the nearest hit under the cursor is almost
 * always the plasma membrane, and aiming at a mitochondrion named the cell wall
 * instead.
 *
 * So we pick by specificity rather than by distance: of everything the ray
 * passes through, the most *contained* thing wins. The ranks below are a
 * containment ladder — membrane, then the cortex lining it, then the organelles
 * inside that, then whatever those organelles hold. Each rung only answers
 * where nothing further in was hit, and ties break by distance, so the nearest
 * of two mitochondria is the one you get.
 *
 * Molecules sit above all of that. A proton is inside a mitochondrion which is
 * inside the cell, so the containment rule would rank it top anyway — but it is
 * also a few pixels across, and saying so outright is what stops the
 * mitochondrion's near wall from answering for the proton drifting behind it.
 */
const STRUCTURE_RANK: Partial<Record<LabelId, number>> = {
  // Encloses everything, so it answers only where the ray hits nothing else.
  plasmaMembrane: 0,
  cytosol: 0,
  // The cortex lines the membrane from inside: outranks it, loses to the
  // organelles it lies in front of.
  actin: 1,
  // Contains the chromatin, the nucleolus and its own pores.
  nucleus: 2,
}
/** Structures containing nothing else the viewer can name. */
const LEAF_RANK = 3
/** The moving cast: always the most specific answer available. */
const MOLECULE_RANK = 4

function rankOf(id: LabelId) {
  if (id in MOLECULE_BY_ID) return MOLECULE_RANK
  return STRUCTURE_RANK[id] ?? LEAF_RANK
}

/** Which named thing an intersected object belongs to, if any. */
export function labelOf(object: THREE.Object3D | null): LabelId | null {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    const id = o.userData?.labelId as LabelId | undefined
    if (id) return id
  }
  return null
}

/**
 * `intersections` is the hit list of one pointer event, sorted near to far
 * (r3f gives it to every handler). Returns the thing the viewer meant.
 */
export function resolvePick(
  intersections: readonly { object: THREE.Object3D }[],
): LabelId | null {
  let best: LabelId | null = null
  let bestRank = -1
  for (const hit of intersections) {
    const id = labelOf(hit.object)
    if (!id) continue
    const rank = rankOf(id)
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
 * ── what is pickable ──
 *
 * Three's raycaster does not test `Object3D.visible`, so anything that hides
 * itself with that flag stays under the cursor and goes on naming itself while
 * invisible. Every mesh in the scene therefore falls into one of three cases,
 * and each has one helper here:
 *
 *  - decoration, never named       → `noPick`
 *  - named, hidden via `.visible`  → `pickWhenVisible`
 *  - named, hidden via scale 0     → nothing needed: a collapsed mesh has no
 *    geometry left to hit, and `instanceSphereRaycast` shrinks with it
 *
 * `drawRange` needs no help either — three honours it while raycasting, so a
 * tube revealed ring by ring is pickable exactly as far as it is drawn.
 *
 * The same blind spot is useful in one place: an invisible mesh still picks, so
 * a hollow shape can be given a solid stand-in target (see the DNA sleeve in
 * Chromatin.tsx) without drawing anything.
 */

/** Decorative bulk: present in the picture, absent from the hit list. */
export const noPick = () => null

/** For meshes that come and go via `.visible`. */
export function pickWhenVisible(
  this: THREE.Mesh,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
) {
  if (!this.visible) return
  THREE.Mesh.prototype.raycast.call(this, raycaster, intersects)
}

/**
 * A cheap stand-in raycast for instanced fields of tiny bodies.
 *
 * Three's own InstancedMesh.raycast walks every triangle of every instance,
 * which is why these fields were unpickable to begin with — hundreds of
 * instances on every pointer move. This tests one sphere per instance instead,
 * reading positions straight out of the instance matrices so animated fields
 * stay correct. `radius` is generous on purpose: a ribosome is a couple of
 * pixels across and needs a bigger target than its own silhouette.
 */
const _inverse = new THREE.Matrix4()
const _localRay = new THREE.Ray()
const _sphere = new THREE.Sphere()
const _centre = new THREE.Vector3()
const _hit = new THREE.Vector3()
const _best = new THREE.Vector3()

/**
 * The same idea for a field of thin filaments: test the ray against each
 * filament's centre line rather than against its triangles. The actin cortex is
 * ninety of them merged into one 20,000-triangle mesh whose bounding sphere is
 * the whole cell, so the real geometry costs several milliseconds on every
 * pointer move and the merge is worth keeping for drawing alone.
 *
 * `radius` is again generous — the filaments are 0.022 across — but it stays
 * far short of a solid shell, so pointing through a gap in the cortex still
 * reaches whatever lies behind it.
 */
export function segmentRaycast(
  segments: readonly (readonly [THREE.Vector3, THREE.Vector3])[],
  radius: number,
) {
  const thresholdSq = radius * radius
  return function raycast(
    this: THREE.Object3D,
    raycaster: THREE.Raycaster,
    intersects: THREE.Intersection[],
  ) {
    if (!this.visible) return

    _inverse.copy(this.matrixWorld).invert()
    _localRay.copy(raycaster.ray).applyMatrix4(_inverse)

    let bestDistance = Infinity
    let hitAny = false
    for (const [a, b] of segments) {
      if (_localRay.distanceSqToSegment(a, b, _hit) > thresholdSq) continue
      const d = _localRay.origin.distanceToSquared(_hit)
      if (d < bestDistance) {
        bestDistance = d
        _best.copy(_hit)
        hitAny = true
      }
    }
    if (!hitAny) return

    const point = _best.clone().applyMatrix4(this.matrixWorld)
    intersects.push({
      distance: raycaster.ray.origin.distanceTo(point),
      point,
      object: this,
    })
  }
}

export function instanceSphereRaycast(radius: number) {
  return function raycast(
    this: THREE.InstancedMesh,
    raycaster: THREE.Raycaster,
    intersects: THREE.Intersection[],
  ) {
    if (!this.visible) return

    const matrices = this.instanceMatrix.array
    _inverse.copy(this.matrixWorld).invert()
    _localRay.copy(raycaster.ray).applyMatrix4(_inverse)
    _localRay.direction.normalize()

    let bestDistance = Infinity
    let bestInstance = -1
    for (let i = 0; i < this.count; i++) {
      const o = i * 16
      _centre.set(matrices[o + 12], matrices[o + 13], matrices[o + 14])
      // Column length = the instance's own scale, which the fields animate —
      // and park at zero for whatever is currently off stage.
      const scale = Math.hypot(matrices[o], matrices[o + 1], matrices[o + 2])
      _sphere.set(_centre, radius * scale)
      if (!_localRay.intersectSphere(_sphere, _hit)) continue
      const d = _localRay.origin.distanceToSquared(_hit)
      if (d < bestDistance) {
        bestDistance = d
        bestInstance = i
        // Its own vector: _hit and _centre are both clobbered by the next
        // instance, and the winner is rarely the last one tested.
        _best.copy(_hit)
      }
    }
    if (bestInstance < 0) return

    // Report in world space: r3f sorts the hit list by this distance.
    const point = _best.clone().applyMatrix4(this.matrixWorld)
    intersects.push({
      distance: raycaster.ray.origin.distanceTo(point),
      point,
      object: this,
      instanceId: bestInstance,
    })
  }
}
