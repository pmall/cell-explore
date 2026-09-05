/**
 * Deterministic pseudo-randomness. The whole cell layout is generated from
 * seeds, so the scene looks identical on every reload — which matters when the
 * guided tours fly the camera to a specific mitochondrion.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private next: () => number
  constructor(seed: number) {
    this.next = mulberry32(seed)
  }
  /** Uniform in [0, 1) */
  unit() {
    return this.next()
  }
  /** Uniform in [min, max) */
  range(min: number, max: number) {
    return min + this.next() * (max - min)
  }
  /** Uniform integer in [min, max] */
  int(min: number, max: number) {
    return Math.floor(this.range(min, max + 1))
  }
  /** Approximately gaussian, mean 0, sd 1 */
  gaussian() {
    let u = 0
    let v = 0
    while (u === 0) u = this.next()
    while (v === 0) v = this.next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }
  /** A random unit vector, uniformly distributed on the sphere. */
  direction(): [number, number, number] {
    const z = this.range(-1, 1)
    const t = this.range(0, Math.PI * 2)
    const r = Math.sqrt(1 - z * z)
    return [r * Math.cos(t), r * Math.sin(t), z]
  }
}
