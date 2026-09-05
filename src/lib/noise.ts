/**
 * 3D simplex noise (Gustavson / Ashima style), used to give membranes their
 * organic, slightly lumpy silhouette. Cells are not spheres.
 */

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
]

const F3 = 1 / 3
const G3 = 1 / 6

function buildPermutation(seed: number) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  // Fisher-Yates with a small LCG so the noise field is reproducible.
  let s = seed >>> 0
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  const perm = new Uint8Array(512)
  const permMod12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    permMod12[i] = perm[i] % 12
  }
  return { perm, permMod12 }
}

export function createNoise3D(seed = 1337) {
  const { perm, permMod12 } = buildPermutation(seed)

  return function noise3D(xin: number, yin: number, zin: number): number {
    const s = (xin + yin + zin) * F3
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const k = Math.floor(zin + s)
    const t = (i + j + k) * G3
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const z0 = zin - (k - t)

    let i1: number, j1: number, k1: number
    let i2: number, j2: number, k2: number
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1 }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1 }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1 }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1 }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
    }

    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3

    const ii = i & 255, jj = j & 255, kk = k & 255
    let n = 0

    const corner = (x: number, y: number, z: number, gi: number) => {
      let t0 = 0.6 - x * x - y * y - z * z
      if (t0 < 0) return 0
      t0 *= t0
      const g = GRAD3[gi]
      return t0 * t0 * (g[0] * x + g[1] * y + g[2] * z)
    }

    n += corner(x0, y0, z0, permMod12[ii + perm[jj + perm[kk]]])
    n += corner(x1, y1, z1, permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]])
    n += corner(x2, y2, z2, permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]])
    n += corner(x3, y3, z3, permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]])

    return 32 * n // roughly [-1, 1]
  }
}

/** Fractal Brownian motion over simplex noise. */
export function fbm3D(
  noise: (x: number, y: number, z: number) => number,
  x: number, y: number, z: number,
  octaves = 3, lacunarity = 2, gain = 0.5,
) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq, z * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}
