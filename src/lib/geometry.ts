import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createNoise3D, fbm3D } from './noise'

/**
 * Nothing in a cell is a clean primitive. These helpers take Three's primitives
 * and rough them up just enough to read as biology rather than as geometry.
 */

/** An icosphere pushed around by fractal noise — the base shape for soft organelles. */
/**
 * Note on `detail`: IcosahedronGeometry subdivides each of its 20 faces into
 * (detail + 1)^2 triangles — it is a linear segment count, not a recursion
 * depth. detail 5 is 720 triangles, not 20,000, which is nowhere near enough
 * for a 10-unit sphere to look round.
 */
export function blobGeometry(
  radius: number,
  detail = 16,
  amplitude = 0.06,
  frequency = 1.1,
  seed = 1,
  /** Fewer octaves = fewer, larger lumps. Big shells want a smooth silhouette. */
  octaves = 3,
) {
  // IcosahedronGeometry is non-indexed with per-face normals baked in, so
  // computeVertexNormals gives flat shading. Indexing it first via mergeVertices
  // mostly works, but its position hash rounds on a fixed grid and ~1% of
  // coincident vertices land either side of a bucket boundary and never merge —
  // those keep face normals and speckle the surface with visible creases.
  //
  // So we skip the whole problem: the blob is star-shaped around its origin, so
  // the outward normal at any vertex is just its normalised position. That is
  // exactly smooth everywhere, regardless of how the geometry is indexed.
  const raw = new THREE.IcosahedronGeometry(radius, detail)
  raw.deleteAttribute('uv')
  const geo = BufferGeometryUtils.mergeVertices(raw)
  raw.dispose()

  const noise = createNoise3D(seed)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = fbm3D(noise, v.x * frequency, v.y * frequency, v.z * frequency, octaves)
    v.multiplyScalar(1 + n * amplitude)
    pos.setXYZ(i, v.x, v.y, v.z)
    v.normalize()
    nrm.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  nrm.needsUpdate = true
  return geo
}

/** An elongated, lumpy capsule — mitochondria, peroxisomes, endosomes. */
export function capsuleBlobGeometry(
  radius: number,
  length: number,
  amplitude = 0.07,
  seed = 1,
  capSegments = 10,
  radialSegments = 24,
) {
  const geo = new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments)
  const noise = createNoise3D(seed)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = fbm3D(noise, v.x * 1.4, v.y * 0.8, v.z * 1.4, 2)
    // Push along the radial direction only, so the capsule stays a capsule.
    const radial = new THREE.Vector3(v.x, 0, v.z)
    if (radial.lengthSq() > 1e-6) radial.normalize()
    v.addScaledVector(radial, n * amplitude * radius)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** Smooth tube through a list of points — chromatin, filaments, RNA strands. */
export function tubeGeometry(
  points: THREE.Vector3[],
  radius: number,
  tubularSegments = 96,
  radialSegments = 8,
  closed = false,
  curveType: 'catmullrom' | 'centripetal' | 'chordal' = 'centripetal',
) {
  const curve = new THREE.CatmullRomCurve3(points, closed, curveType, 0.5)
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
}

/**
 * A Golgi cisterna: a flattened sac with a rounded rim, bowed into a shallow
 * dish. Built by revolving a profile rather than deforming a torus, because a
 * torus keeps a hole in the middle and a cisterna does not have one.
 */
export function cisternaGeometry(
  radius: number,
  thickness: number,
  bow = 0.22,
  wobble = 0.07,
  seed = 3,
  radialSegments = 84,
) {
  const rim = Math.max(0.02, thickness)
  const flat = Math.max(0.05, radius - rim)
  const profile: THREE.Vector2[] = []

  // Top face, from the centre outward.
  profile.push(new THREE.Vector2(0.0001, rim))
  profile.push(new THREE.Vector2(flat * 0.55, rim * 1.04))
  profile.push(new THREE.Vector2(flat, rim))
  // Rounded rim, wrapping from the top face to the bottom one.
  const rimSteps = 7
  for (let i = 1; i < rimSteps; i++) {
    const a = (i / rimSteps) * Math.PI
    profile.push(new THREE.Vector2(flat + Math.sin(a) * rim, Math.cos(a) * rim))
  }
  // Bottom face, back to the centre.
  profile.push(new THREE.Vector2(flat, -rim))
  profile.push(new THREE.Vector2(flat * 0.55, -rim * 1.04))
  profile.push(new THREE.Vector2(0.0001, -rim))

  const geo = new THREE.LatheGeometry(profile, radialSegments)

  const noise = createNoise3D(seed)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = Math.hypot(v.x, v.z)
    const t = r / radius
    // Bow the disc into a dish, and ruffle its rim — real cisternae are neither
    // flat nor perfectly round.
    const n = noise(v.x * 1.3, v.z * 1.3, seed * 0.37)
    const scale = 1 + n * wobble * t
    v.x *= scale
    v.z *= scale
    v.y += bow * t * t + n * wobble * 0.4 * t
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/**
 * A rippled sheet — used for ER cisternae and mitochondrial cristae. The ripple
 * is what makes these read as membrane rather than as cardboard.
 */
export function sheetGeometry(
  width: number,
  height: number,
  ripple = 0.18,
  rippleFreq = 2.4,
  seed = 7,
  segX = 40,
  segY = 24,
) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY)
  const noise = createNoise3D(seed)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const wave = Math.sin(x * rippleFreq) * 0.6 + noise(x * 0.6, y * 0.6, seed * 0.1) * 0.8
    // Taper towards the edges so sheets have soft, rounded outlines.
    const edge = Math.cos((x / width) * Math.PI) * Math.cos((y / height) * Math.PI)
    pos.setZ(i, wave * ripple * Math.max(0, edge))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** The classic two-lobed ribosome silhouette, as one merged geometry. */
export function ribosomeGeometry(scale = 1) {
  // Deliberately coarse: these render a few pixels across and there are
  // hundreds of them, so detail here buys nothing and costs everything.
  const large = new THREE.SphereGeometry(0.62 * scale, 7, 5)
  large.translate(0, -0.12 * scale, 0)
  large.scale(1, 0.92, 1)
  const small = new THREE.SphereGeometry(0.42 * scale, 6, 4)
  small.translate(0, 0.5 * scale, 0.04 * scale)
  small.scale(1.05, 0.8, 1)
  const merged = BufferGeometryUtils.mergeGeometries([large, small], false)
  large.dispose()
  small.dispose()
  merged.computeVertexNormals()
  return merged
}

/** Quaternion that points an object's +Y axis along `dir`. */
export function orientToDirection(dir: THREE.Vector3, out = new THREE.Quaternion()) {
  return out.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
}

export { BufferGeometryUtils }
