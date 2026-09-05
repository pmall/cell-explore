import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import { useStore } from '../state/store'

/**
 * Bloom is doing real work here, not decoration: the membranes carry their
 * information in thin fresnel rims, and a little glow is what turns those rims
 * into readable silhouettes when six translucent shells overlap.
 */
export function Effects() {
  const quality = useStore((s) => s.quality)
  if (quality === 'low') return null

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.75}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.5}
        mipmapBlur
        kernelSize={KernelSize.LARGE}
      />
      <Vignette offset={0.28} darkness={0.62} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  )
}
