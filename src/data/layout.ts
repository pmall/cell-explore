import * as THREE from 'three'
import { Rng } from '../lib/rng'

/**
 * The cell's floor plan. Everything is generated once from a fixed seed so the
 * layout is byte-identical on every load — guided tours fly the camera to
 * hard-coded coordinates, and those coordinates have to keep meaning something.
 *
 * Units: 1 world unit ~= 1 micrometre at cell scale. A real animal cell is
 * 10-30 um across; ours is 20 units wide, which is honest.
 */

export const CELL_RADIUS = 10
/** Organelles are kept inside this radius so nothing pokes through the membrane. */
export const CYTOSOL_RADIUS = 8.1

export const NUCLEUS = {
  center: new THREE.Vector3(-1.6, 0.8, -0.6),
  radius: 3.5,
  /** Gap between the inner and outer nuclear membrane. */
  envelopeGap: 0.22,
}

export const NUCLEOLUS = {
  center: NUCLEUS.center.clone().add(new THREE.Vector3(0.9, -0.5, 0.6)),
  radius: 1.15,
}

export const CENTROSOME = {
  center: new THREE.Vector3(1.9, 2.9, -1.4),
}

export const GOLGI = {
  center: new THREE.Vector3(3.5, -2.4, 1.4),
  /** Stack axis: cis face at -axis, trans face at +axis. */
  axis: new THREE.Vector3(0.25, 1, 0.35).normalize(),
  cisternae: 6,
  radius: 1.85,
}

/**
 * A rough-ER cisterna, in the nucleus-centred spherical frame.
 *
 * The rough ER used to be built as open patches of a sphere: a single rippled
 * surface per cisterna, alpha-faded at its borders. Independent single surfaces
 * with no edge and no thickness read as torn paper, and because each patch had
 * its own random centre they were never parallel to one another, so the stack —
 * the thing that actually makes rough ER recognisable — was not there to see.
 *
 * Now each cisterna is a genuine closed sac, and cisternae come in stacks that
 * share an angular centre so they sit as parallel lamellae. The whole thing
 * lives in (theta, phi, r) space, so a stack curves around the nucleus for free.
 */
export type CisternaSpec = {
  /** Radius of the mid-surface, from the nucleus centre. */
  radius: number
  thetaCentre: number
  thetaSpan: number
  phiCentre: number
  phiSpan: number
  /** Half-thickness of the sac, in radial units. */
  thickness: number
  ripple: number
  /** Shared across a stack, so lamellae undulate together instead of crossing. */
  stackSeed: number
  seed: number
}

/** Stacks of parallel cisternae, wrapped around the nuclear envelope. */
export const CISTERNAE: CisternaSpec[] = (() => {
  const rng = new Rng(60601)
  const out: CisternaSpec[] = []
  for (let stack = 0; stack < 5; stack++) {
    const thetaCentre = rng.range(0.8, Math.PI - 0.8)
    const phiCentre = rng.range(-0.8, 3.2)
    const stackSeed = rng.int(1, 9999)
    const base = NUCLEUS.radius + 0.5 + rng.range(0, 0.5)
    const count = rng.int(3, 4)
    for (let i = 0; i < count; i++) {
      out.push({
        // Even radial spacing is what reads as a stack; jitter it only slightly.
        radius: base + i * 0.38 + rng.range(-0.03, 0.03),
        // Cisternae are ribbons, not walls: narrow in theta, long in phi.
        thetaCentre: thetaCentre + rng.range(-0.05, 0.05),
        thetaSpan: rng.range(0.38, 0.5),
        phiCentre: phiCentre + rng.range(-0.06, 0.06),
        phiSpan: rng.range(1.2, 1.65),
        thickness: rng.range(0.07, 0.1),
        ripple: rng.range(0.1, 0.16),
        stackSeed,
        seed: rng.int(1, 9999),
      })
    }
  }
  return out
})()

/**
 * A cisterna's mid-surface centre, in world space. The camera targets below use
 * it so that "show me the rough ER" lands on an actual sac rather than on a
 * hand-typed offset that the stacks may have wandered away from.
 */
function cisternaCentre(spec: CisternaSpec, radialOffset = 0) {
  const r = spec.radius + radialOffset
  const t = spec.thetaCentre
  const p = spec.phiCentre
  return new THREE.Vector3(
    Math.sin(t) * Math.cos(p) * r,
    Math.cos(t) * r,
    Math.sin(t) * Math.sin(p) * r,
  ).add(NUCLEUS.center)
}

/** The stack with the most cisternae: the one that best reads as lamellae. */
const FEATURED_STACK = (() => {
  const byStack = new Map<number, CisternaSpec[]>()
  for (const c of CISTERNAE) {
    const list = byStack.get(c.stackSeed) ?? []
    list.push(c)
    byStack.set(c.stackSeed, list)
  }
  let best: CisternaSpec[] = []
  for (const list of byStack.values()) if (list.length > best.length) best = list
  return best
})()

/** Centre of that stack — mid-cisterna, so the camera sees sheets either side. */
export const ROUGH_ER_FOCUS = cisternaCentre(FEATURED_STACK[Math.floor(FEATURED_STACK.length / 2)])

/**
 * Ribosomes are everywhere, so "a ribosome" has to mean somewhere in
 * particular: just off the outermost sac of that same stack, which is where
 * they are densest and where being *bound to the ER* is legible.
 */
export const RIBOSOME_FOCUS = cisternaCentre(
  FEATURED_STACK[FEATURED_STACK.length - 1],
  0.35,
)

/** Where the rough ER hands cargo off to the Golgi (an "ER exit site"). */
export const ER_EXIT_SITE = new THREE.Vector3(2.2, -1.0, 1.6)

export type Placement = {
  id: string
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: number
  /** Per-instance phase offset so identical objects don't animate in lockstep. */
  phase: number
}

function randomQuaternion(rng: Rng) {
  const u1 = rng.unit()
  const u2 = rng.unit()
  const u3 = rng.unit()
  return new THREE.Quaternion(
    Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2),
    Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2),
    Math.sqrt(u1) * Math.sin(2 * Math.PI * u3),
    Math.sqrt(u1) * Math.cos(2 * Math.PI * u3),
  )
}

/** Rejection-sample points that sit in the cytosol and clear the nucleus. */
function scatter(
  rng: Rng,
  count: number,
  opts: { minR: number; maxR: number; clearance: number; prefix: string; scaleRange?: [number, number] },
): Placement[] {
  const out: Placement[] = []
  let guard = 0
  while (out.length < count && guard++ < count * 400) {
    const [dx, dy, dz] = rng.direction()
    const r = Math.cbrt(rng.unit()) * (opts.maxR - opts.minR) + opts.minR
    const p = new THREE.Vector3(dx * r, dy * r, dz * r)
    if (p.distanceTo(NUCLEUS.center) < NUCLEUS.radius + opts.clearance) continue
    if (p.distanceTo(GOLGI.center) < GOLGI.radius + opts.clearance * 0.5) continue
    if (out.some((o) => o.position.distanceTo(p) < opts.clearance * 1.4)) continue
    const [smin, smax] = opts.scaleRange ?? [0.85, 1.15]
    out.push({
      id: `${opts.prefix}-${out.length}`,
      position: p,
      quaternion: randomQuaternion(rng),
      scale: rng.range(smin, smax),
      phase: rng.range(0, Math.PI * 2),
    })
  }
  return out
}

const rng = new Rng(20260905)

/**
 * These reach further out than they used to: the outer third of the cytosol was
 * empty dark space and the cell read as a small busy core inside a large bubble.
 * It is the outer bound that moved, not the inner one — raising both as well
 * simply evacuated the middle and left a hole where the core had been.
 * CYTOSOL_RADIUS is 8.1, so these now run most of the way to the membrane.
 */
export const MITOCHONDRIA = scatter(rng, 7, {
  minR: 4.0, maxR: 7.9, clearance: 1.5, prefix: 'mito', scaleRange: [0.8, 1.35],
})

/**
 * The mitochondrion the bioenergetics tour flies into: whichever one sits
 * furthest from the nucleus, so the close-up is not looking through chromatin.
 */
export const FEATURED_MITOCHONDRION = MITOCHONDRIA.reduce(
  (best, m, i) =>
    m.position.distanceTo(NUCLEUS.center) > MITOCHONDRIA[best].position.distanceTo(NUCLEUS.center)
      ? i
      : best,
  0,
)

/**
 * The proton circuit inside a mitochondrion, in its local frame (long axis Y,
 * radius ~0.52). Lives here rather than in the animation because the guided
 * tour needs to point a camera at the ATP synthase, and both have to agree on
 * where that is.
 */
export const MITO_PROTON_LOOP = [
  new THREE.Vector3(0.0, -0.62, 0.0), // matrix
  new THREE.Vector3(0.16, -0.34, 0.1), // approaching complex I
  new THREE.Vector3(0.34, -0.05, 0.06), // pumped across the crista
  new THREE.Vector3(0.5, 0.28, 0.0), // intermembrane space
  new THREE.Vector3(0.46, 0.66, -0.06), // crowding against the outer membrane
  new THREE.Vector3(0.22, 0.88, 0.0), // entering ATP synthase
  new THREE.Vector3(0.06, 0.5, 0.04), // falling through the rotor
  new THREE.Vector3(-0.02, 0.0, 0.0), // back in the matrix
  new THREE.Vector3(-0.1, -0.42, -0.04),
]

export const MITO_SYNTHASE_LOCAL = new THREE.Vector3(0.16, 0.72, 0.0)

/** Where that synthase actually is in the cell, so the camera can find it. */
export const MITO_SYNTHASE_WORLD = (() => {
  const host = MITOCHONDRIA[FEATURED_MITOCHONDRION]
  return MITO_SYNTHASE_LOCAL.clone()
    .multiplyScalar(host.scale)
    .applyQuaternion(host.quaternion)
    .add(host.position)
})()

export const LYSOSOMES = scatter(rng, 6, {
  minR: 3.6, maxR: 7.9, clearance: 1.0, prefix: 'lyso', scaleRange: [0.7, 1.2],
})

export const PEROXISOMES = scatter(rng, 5, {
  minR: 3.8, maxR: 7.8, clearance: 0.9, prefix: 'perox', scaleRange: [0.6, 0.95],
})

export const FREE_RIBOSOMES = scatter(rng, 130, {
  minR: 3.9, maxR: 7.9, clearance: 0.28, prefix: 'ribo', scaleRange: [0.8, 1.2],
})

export const CYTOSOL_VESICLES = scatter(rng, 26, {
  minR: 3.8, maxR: 7.9, clearance: 0.7, prefix: 'ves', scaleRange: [0.55, 1.0],
})

/**
 * Vesicles are scattered through the whole cytosol, so pointing the camera at
 * the middle of the swarm frames nothing at all — and a single vesicle is a
 * 0.2-unit bubble that wanders half a unit as it drifts, so aiming at one of
 * those misses too. Aim at the tightest trio instead: three bubbles drifting
 * independently keep their centroid roughly still, and the panel is about
 * vesicles in the plural anyway.
 */
export const VESICLE_CLUSTER = (() => {
  let best: { centre: THREE.Vector3; spread: number } | null = null
  for (const v of CYTOSOL_VESICLES) {
    const near = CYTOSOL_VESICLES.filter((o) => o !== v)
      .sort((a, b) => a.position.distanceTo(v.position) - b.position.distanceTo(v.position))
      .slice(0, 2)
    const spread = near[1].position.distanceTo(v.position)
    if (best && spread >= best.spread) continue
    const centre = v.position.clone().add(near[0].position).add(near[1].position).divideScalar(3)
    best = { centre, spread }
  }
  return best!
})()

/** Microtubules radiate from the centrosome out towards the cell cortex. */
export const MICROTUBULES = (() => {
  const r = new Rng(778811)
  const out: { end: THREE.Vector3; bend: THREE.Vector3; phase: number }[] = []
  for (let i = 0; i < 26; i++) {
    const [dx, dy, dz] = r.direction()
    const dir = new THREE.Vector3(dx, dy, dz)
    // Bias outward-and-away from the nucleus so tubules don't tunnel through it.
    const away = CENTROSOME.center.clone().sub(NUCLEUS.center).normalize()
    dir.lerp(away, 0.35).normalize()
    const len = r.range(4.4, 7.0)
    const end = CENTROSOME.center.clone().add(dir.multiplyScalar(len))
    if (end.length() > 7.9) end.setLength(7.9)
    const mid = CENTROSOME.center.clone().lerp(end, 0.5)
    const bend = mid.add(new THREE.Vector3(r.gaussian(), r.gaussian(), r.gaussian()).multiplyScalar(0.7))
    out.push({ end, bend, phase: r.range(0, Math.PI * 2) })
  }
  return out
})()

/** Cortical actin: short curved filaments hugging the inside of the membrane. */
export const ACTIN_FILAMENTS = (() => {
  const r = new Rng(30303)
  const out: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; phase: number }[] = []
  for (let i = 0; i < 90; i++) {
    const [dx, dy, dz] = r.direction()
    const base = new THREE.Vector3(dx, dy, dz).multiplyScalar(r.range(8.0, 8.9))
    const tangent = new THREE.Vector3(r.gaussian(), r.gaussian(), r.gaussian())
      .projectOnPlane(base.clone().normalize())
      .normalize()
      .multiplyScalar(r.range(1.1, 2.6))
    const a = base.clone().sub(tangent)
    const b = base.clone().add(tangent)
    const c = base.clone().multiplyScalar(r.range(0.94, 1.0))
    out.push({ a, b, c, phase: r.range(0, Math.PI * 2) })
  }
  return out
})()

/** Membrane-embedded proteins: receptors, channels, pumps. */
export const MEMBRANE_PROTEINS = (() => {
  const r = new Rng(99001)
  const out: { dir: THREE.Vector3; kind: 'receptor' | 'channel' | 'pump'; phase: number }[] = []
  const kinds = ['receptor', 'channel', 'pump'] as const
  for (let i = 0; i < 140; i++) {
    const [dx, dy, dz] = r.direction()
    out.push({
      dir: new THREE.Vector3(dx, dy, dz),
      kind: kinds[r.int(0, 2)],
      phase: r.range(0, Math.PI * 2),
    })
  }
  return out
})()

/** The signalling receptor the tour zooms into — fixed so the camera can find it. */
export const SIGNAL_RECEPTOR_DIR = new THREE.Vector3(0.62, 0.34, 0.71).normalize()

/** The nuclear pore that exported mRNA travels through. */
export const EXPORT_PORE_DIR = new THREE.Vector3(0.78, -0.12, 0.61).normalize()

/** Nuclear pores, spread evenly with a Fibonacci sphere. */
export const NUCLEAR_PORES = (() => {
  const n = 34
  const out: THREE.Vector3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    out.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius))
  }
  // Guarantee the export pore exists exactly where the tour expects it.
  out[0] = EXPORT_PORE_DIR.clone()
  return out
})()


/** The gene the central-dogma tour transcribes, in nucleus-local coordinates. */
export const ACTIVE_GENE = {
  start: new THREE.Vector3(-1.5, -0.9, 1.5),
  end: new THREE.Vector3(1.7, 0.4, 1.35),
  /** Local axis the helix twists around. */
  get direction() {
    return this.end.clone().sub(this.start).normalize()
  },
  get length() {
    return this.end.distanceTo(this.start)
  },
}

/** Shortest distance from a point to the active gene, in nucleus-local space. */
function distanceToGene(p: THREE.Vector3) {
  const ab = ACTIVE_GENE.end.clone().sub(ACTIVE_GENE.start)
  const t = THREE.MathUtils.clamp(p.clone().sub(ACTIVE_GENE.start).dot(ab) / ab.lengthSq(), 0, 1)
  return p.distanceTo(ACTIVE_GENE.start.clone().addScaledVector(ab, t))
}

/** Chromatin territories: tangled loops filling the nucleoplasm. */
export const CHROMATIN = (() => {
  const r = new Rng(5150)
  const strands: { points: THREE.Vector3[]; colorIndex: number; phase: number }[] = []
  for (let s = 0; s < 5; s++) {
    const points: THREE.Vector3[] = []
    // Each chromosome occupies its own territory rather than mixing freely.
    const [tx, ty, tz] = r.direction()
    const territory = new THREE.Vector3(tx, ty, tz).multiplyScalar(NUCLEUS.radius * 0.42)
    let cursor = territory.clone()
    for (let i = 0; i < 26; i++) {
      cursor = cursor
        .clone()
        .add(new THREE.Vector3(r.gaussian(), r.gaussian(), r.gaussian()).multiplyScalar(0.62))
        .lerp(territory, 0.22)
      const local = cursor.clone()
      if (local.length() > NUCLEUS.radius * 0.82) local.setLength(NUCLEUS.radius * 0.82)
      // Keep a clear corridor around the transcribed gene: the tour flies right
      // into it, and a fibre crossing the shot hides the whole mechanism.
      const clearance = 1.5
      const d = distanceToGene(local)
      if (d < clearance) {
        const away = local.clone().sub(ACTIVE_GENE.start).normalize()
        local.addScaledVector(away, clearance - d)
        if (local.length() > NUCLEUS.radius * 0.82) local.setLength(NUCLEUS.radius * 0.82)
      }
      points.push(local)
    }
    strands.push({ points, colorIndex: s, phase: r.range(0, Math.PI * 2) })
  }
  return strands
})()

