import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { blobGeometry } from '../../lib/geometry'
import { MembraneMaterial, useMembraneMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { CELL_RADIUS } from '../../data/layout'
import { Highlightable } from '../Highlightable'
import { noPick } from '../picking'
import { cellTime } from '../clock'

/**
 * The plasma membrane is drawn as two nested shells: the bilayer itself and an
 * inner face. Real membranes are two lipid leaflets, and separating them here is
 * what stops the cell reading as a glass marble.
 *
 * There used to be a third shell outside these — a glycocalyx halo at 1.03x the
 * radius. Displaced by the same noise as the shells below it, its own outline
 * sat *outside* theirs, so what you actually saw at the silhouette was the
 * halo's crenellations: the cell read as crumpled foil. The outer shell's
 * fresnel rim carries the edge on its own, so the halo is gone and the rim is
 * turned up to make up the lost glow. Only two octaves of noise here as well,
 * so the remaining lumps are large and few rather than a fine ripple.
 *
 * It also fades out as the camera moves inside, so the viewer is never staring
 * at the back of a wall.
 */
export function PlasmaMembrane() {
  const outerGeo = useMemo(() => blobGeometry(CELL_RADIUS, 26, 0.03, 0.34, 11, 2), [])
  const innerGeo = useMemo(() => blobGeometry(CELL_RADIUS * 0.978, 20, 0.03, 0.34, 11, 2), [])

  const outerMat = useMembraneMaterial({
    base: palette.membrane.base,
    rim: palette.membrane.rim,
    // A broad, low-power fresnel spreads its glow across the whole disc, and at
    // this radius that disc is most of the frame: the cell ended up behind a
    // milky veil that bloom then amplified. Tight rim, faint face.
    opacity: 0.05,
    rimStrength: 0.9,
    rimPower: 3.4,
    emissive: 0.55,
    side: THREE.FrontSide,
    wobble: 0.05,
    wobbleFreq: 0.9,
  })
  const innerMat = useMembraneMaterial({
    base: palette.membrane.base,
    rim: palette.membrane.rim,
    opacity: 0.03,
    rimStrength: 0.34,
    rimPower: 4.2,
    emissive: 0.2,
    side: THREE.BackSide,
    wobble: 0.05,
    wobbleFreq: 0.9,
  })
  const camera = useThree((s) => s.camera)
  const fade = useRef(1)

  const bases = useMemo(
    () =>
      [outerMat, innerMat].map((m) => ({
        mat: m,
        opacity: m.uniforms.uOpacity.value as number,
        rim: m.uniforms.uRimStrength.value as number,
      })),
    [outerMat, innerMat],
  )

  useFrame((_, delta) => {
    const t = cellTime()
    for (const m of [outerMat, innerMat]) (m as MembraneMaterial).time = t

    // Inside the cell? Pull the shell back so it stops occluding the interior.
    const d = camera.position.length()
    const target = THREE.MathUtils.smoothstep(d, CELL_RADIUS * 0.78, CELL_RADIUS * 1.35)
    fade.current += (Math.max(0.18, target) - fade.current) * Math.min(1, delta * 3)

    for (const b of bases) {
      b.mat.uniforms.uOpacity.value = b.opacity * fade.current
      b.mat.uniforms.uRimStrength.value = b.rim * (0.35 + 0.65 * fade.current)
    }
  })

  return (
    <Highlightable id="plasmaMembrane" neverDim>
      <mesh geometry={outerGeo} material={outerMat} renderOrder={-1} />
      <mesh geometry={innerGeo} material={innerMat} renderOrder={-1} raycast={noPick} />
    </Highlightable>
  )
}
