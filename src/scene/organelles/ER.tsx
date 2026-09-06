import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js'
import { BufferGeometryUtils, ribosomeGeometry, tubeGeometry } from '../../lib/geometry'
import { createNoise3D } from '../../lib/noise'
import { MembraneMaterial, useMembraneMaterial, useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { CISTERNAE, NUCLEUS, type CisternaSpec } from '../../data/layout'
import { Rng } from '../../lib/rng'
import { Highlightable } from '../Highlightable'
import { instanceSphereRaycast } from '../picking'
import { cellTime } from '../clock'

/**
 * The ER is one continuous membrane that starts at the nuclear envelope. Near
 * the nucleus it is stacked flat sheets studded with ribosomes (rough ER);
 * further out it becomes a branching tubular network with no ribosomes at all
 * (smooth ER). Both are built here from the same nucleus-centred frame.
 */

/**
 * The mid-surface of a cisterna: the sheet the two membrane faces straddle.
 * `a` and `b` are patch coordinates in [-1, 1], both zero at the centre.
 */
function midSurface(spec: CisternaSpec) {
  const noise = createNoise3D(spec.stackSeed)
  return (a: number, b: number, target: THREE.Vector3) => {
    const theta = spec.thetaCentre + (spec.thetaSpan / 2) * a
    const phi = spec.phiCentre + (spec.phiSpan / 2) * b
    // Undulation driven by the stack's own noise, so every cisterna in a stack
    // bends the same way and they stay parallel rather than intersecting.
    const r = spec.radius + noise(theta * 2.2, phi * 2.2, 0) * spec.ripple
    target.set(
      Math.sin(theta) * Math.cos(phi) * r,
      Math.cos(theta) * r,
      Math.sin(theta) * Math.sin(phi) * r,
    )
    return target
  }
}

/**
 * Half-thickness at patch coordinate (a, b). Zero at the border, which is what
 * closes the sac and rounds its rim: the sac is an ellipsoid in (theta, phi, r)
 * space, so its edge is a genuine rounded lip rather than a cut-off surface.
 *
 * Fenestrations: real rough-ER sheets are perforated. Pinching the thickness to
 * zero in a few spots welds the two faces together there, and against the dark
 * cytosol those welds read as the holes they are — far cheaper than actually
 * cutting the mesh, which would leave open boundary edges to hide.
 */
function halfThickness(spec: CisternaSpec, holes: (x: number, y: number, z: number) => number) {
  return (a: number, b: number) => {
    const dome = Math.sqrt(Math.max(0, 1 - a * a - b * b))
    const h = holes(a * 2.6, b * 2.6, spec.seed * 0.11)
    const perforation = THREE.MathUtils.smoothstep(h, -0.66, -0.44)
    return spec.thickness * dome * perforation
  }
}

/** The closed surface of one cisterna, for ParametricGeometry. */
function cisternaSurface(spec: CisternaSpec) {
  const mid = midSurface(spec)
  const thickness = halfThickness(spec, createNoise3D(spec.seed))
  const centre = new THREE.Vector3()
  return (u: number, v: number, target: THREE.Vector3) => {
    // Sphere-topology parametrisation squashed into the sac: the two polar
    // directions become the in-plane axes, and the remaining axis becomes
    // thickness. Watertight, and no special case at the rim.
    const alpha = Math.PI * u
    const beta = 2 * Math.PI * v
    const a = Math.sin(alpha) * Math.cos(beta)
    const b = Math.sin(alpha) * Math.sin(beta)
    mid(a, b, centre)
    // The sac is thin, so the offset direction is just the outward radial one.
    const h = thickness(a, b) * Math.sign(Math.cos(alpha))
    target.copy(centre).multiplyScalar(1 + h / centre.length())
  }
}

function RoughERCisternae() {
  const geometries = useMemo(
    () => CISTERNAE.map((c) => new ParametricGeometry(cisternaSurface(c), 56, 40)),
    [],
  )
  const mat = useMembraneMaterial({
    base: palette.roughER.base,
    rim: palette.roughER.rim,
    // Closed shells render front faces only. DoubleSide with depthWrite off
    // would blend every triangle against its own back face in arbitrary order,
    // which looks like faceting. The rim carries the lip on its own.
    side: THREE.FrontSide,
    // Three or four translucent sacs overlap wherever a stack is edge-on, so
    // each one has to be faint or the stack blooms into a solid white clump.
    opacity: 0.18,
    rimStrength: 0.42,
    rimPower: 2.4,
    emissive: 0.26,
    wobble: 0.02,
    wobbleFreq: 2.4,
  })

  useFrame(() => {
    ;(mat as MembraneMaterial).time = cellTime()
  })

  return (
    <Highlightable id="roughER">
      <group position={NUCLEUS.center}>
        {geometries.map((g, i) => (
          <mesh key={i} geometry={g} material={mat} renderOrder={2} />
        ))}
      </group>
    </Highlightable>
  )
}

/** A pick target a little wider than the bead itself: they are a few px across. */
const RIBOSOME_PICK = instanceSphereRaycast(0.17)

/** Ribosomes bound to the ER surface — what makes rough ER rough. */
function BoundRibosomes() {
  const placements = useMemo(() => {
    const rng = new Rng(31415)
    const out: { position: THREE.Vector3; normal: THREE.Vector3 }[] = []
    const mid = new THREE.Vector3()
    for (const spec of CISTERNAE) {
      const surface = midSurface(spec)
      const thickness = halfThickness(spec, createNoise3D(spec.seed))
      let placed = 0
      let guard = 0
      while (placed < 16 && guard++ < 400) {
        // Sample the flat faces, not the rim: keep well inside the unit disc
        // that bounds the patch, or ribosomes end up straddling the lip.
        const a = rng.range(-0.82, 0.82)
        const b = rng.range(-0.82, 0.82)
        if (a * a + b * b > 0.68) continue
        const h = thickness(a, b)
        // A perforation has no membrane to sit on.
        if (h < spec.thickness * 0.35) continue
        surface(a, b, mid)
        const normal = mid.clone().normalize() // radial: the sacs are thin shells
        const side = rng.unit() > 0.5 ? 1 : -1
        out.push({
          position: mid.clone().addScaledVector(normal, side * (h + 0.1)),
          normal: normal.multiplyScalar(side),
        })
        placed++
      }
    }
    return out
  }, [])

  const geometry = useMemo(() => ribosomeGeometry(0.13), [])
  const material = useSolidMaterial(palette.ribosome, { emissive: 0.2 })
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    placements.forEach((p, i) => {
      dummy.position.copy(p.position)
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.normal)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [placements, dummy])

  return (
    <Highlightable id="ribosome">
      <group position={NUCLEUS.center}>
        <instancedMesh
          ref={ref}
          args={[geometry, material, placements.length]}
          frustumCulled={false}
          raycast={RIBOSOME_PICK}
        />
      </group>
    </Highlightable>
  )
}

/**
 * Smooth ER: a branching tubular network. Generated as a random tree so the
 * junctions look grown rather than drawn.
 */
function SmoothER() {
  const geometry = useMemo(() => {
    const rng = new Rng(8080)
    const root = new THREE.Vector3(4.4, -0.4, 2.7)
    const tubes: THREE.BufferGeometry[] = []

    const branch = (from: THREE.Vector3, dir: THREE.Vector3, depth: number, radius: number) => {
      if (depth > 3) return
      const pts = [from.clone()]
      let cursor = from.clone()
      let d = dir.clone()
      const segments = rng.int(3, 4)
      for (let i = 0; i < segments; i++) {
        d = d
          .clone()
          .add(new THREE.Vector3(rng.gaussian(), rng.gaussian(), rng.gaussian()).multiplyScalar(0.45))
          .normalize()
        cursor = cursor.clone().addScaledVector(d, rng.range(0.45, 0.85))
        // Stay in the cytosol and out of the nucleus.
        if (cursor.length() > 7.4) cursor.setLength(7.4)
        if (cursor.distanceTo(NUCLEUS.center) < NUCLEUS.radius + 0.6) {
          cursor.sub(NUCLEUS.center).setLength(NUCLEUS.radius + 0.6).add(NUCLEUS.center)
        }
        pts.push(cursor.clone())
      }
      tubes.push(tubeGeometry(pts, radius, pts.length * 8, 7))
      const children = depth < 2 ? rng.int(2, 3) : rng.int(0, 1)
      for (let i = 0; i < children; i++) {
        const nd = d
          .clone()
          .add(new THREE.Vector3(rng.gaussian(), rng.gaussian(), rng.gaussian()).multiplyScalar(0.9))
          .normalize()
        branch(cursor, nd, depth + 1, radius * 0.85)
      }
    }

    for (let i = 0; i < 5; i++) {
      const [dx, dy, dz] = rng.direction()
      branch(root, new THREE.Vector3(dx, dy, dz), 0, 0.14)
    }

    const merged = BufferGeometryUtils.mergeGeometries(tubes, false)
    tubes.forEach((t) => t.dispose())
    return merged
  }, [])

  const mat = useMembraneMaterial({
    base: palette.smoothER.base,
    rim: palette.smoothER.rim,
    // Toned down along with the recolour: the tubule network sprawls across a
    // large part of the frame, and at the old glow it was the brightest thing
    // in the cell for no good reason.
    opacity: 0.3,
    rimStrength: 0.45,
    rimPower: 2.2,
    emissive: 0.26,
    side: THREE.DoubleSide,
  })

  useFrame(() => {
    ;(mat as MembraneMaterial).time = cellTime()
  })

  return (
    <Highlightable id="smoothER">
      <mesh geometry={geometry} material={mat} renderOrder={2} />
    </Highlightable>
  )
}

export function EndoplasmicReticulum() {
  return (
    <>
      <RoughERCisternae />
      <BoundRibosomes />
      <SmoothER />
    </>
  )
}
