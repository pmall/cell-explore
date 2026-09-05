import * as THREE from 'three'
import { useMemo } from 'react'
import { palette } from '../theme/palette'

/**
 * One depth-haze curve, shared by the shell shader and by three's own fog on the
 * solid bodies, so the two families of material agree about how far away
 * something looks. Distances are absolute world units from the camera: the cell
 * is 20 units across, so from a typical orbit the near and far walls straddle
 * this range, and once the camera is inside the cell the haze relaxes on its own.
 */
export const FOG = { color: palette.cytosol, near: 17, far: 52 }

/**
 * The look of the whole scene comes from one material: a translucent shell with
 * a fresnel rim. Real membranes are thin lipid bilayers — you see straight
 * through the middle of them and they catch light at grazing angles, which is
 * exactly what a fresnel term does. Stacking a few of these (outer membrane,
 * inner membrane, lumen) gives the soft depth that a plain opaque mesh cannot.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;
  uniform float uWobbleFreq;

  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec3 pos = position;
    vUv = uv;

    // Gentle breathing so nothing in the cell ever looks frozen.
    if (uWobble > 0.0) {
      float w = sin(pos.x * uWobbleFreq + uTime * 0.7)
              * sin(pos.y * uWobbleFreq * 1.3 + uTime * 0.53)
              * sin(pos.z * uWobbleFreq * 0.8 + uTime * 0.61);
      pos += normal * w * uWobble;
    }

    vLocalPos = pos;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uRimPower;
  uniform float uRimStrength;
  uniform float uDim;
  uniform float uEmissive;
  uniform vec3 uLightDir;

  uniform float uEdgeFade;

  // Aerial perspective. Three's built-in fog does not reach a raw ShaderMaterial,
  // and without it every shell renders at the same brightness whatever its
  // distance, which flattens the cell into a decal.
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFogAmount;

  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(vViewDir);

    // Two-sided: we render back faces for the shell effect, so flip inward normals.
    if (!gl_FrontFacing) n = -n;

    float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), uRimPower);

    // Soft wrap lighting keeps volume readable without hard specular highlights.
    float diffuse = 0.55 + 0.45 * dot(n, normalize(uLightDir));
    diffuse = clamp(diffuse, 0.25, 1.25);

    vec3 color = mix(uBase * diffuse, uRim, fres * 0.85);
    color += uRim * uEmissive * fres;

    float alpha = (uOpacity + fres * uRimStrength) * uDim;

    // Open surfaces dissolve at their borders rather than ending in a cut edge.
    if (uEdgeFade > 0.0) {
      float e = pow(max(0.0, sin(vUv.x * 3.14159) * sin(vUv.y * 3.14159)), 0.55);
      alpha *= mix(1.0, e, uEdgeFade);
    }

    // Distance haze: sink the surface towards the cytosol colour and thin it out,
    // so far shells sit behind near ones instead of beside them. The target is
    // mostly the fog colour rather than the fragment's own luminance — against a
    // dark background, desaturating to grey keeps the brightness and the far
    // shells turn milky instead of receding.
    float haze = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWorldPos)) * uFogAmount;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(color, mix(vec3(luma), uFogColor, 0.85), haze * 0.8);
    alpha *= 1.0 - haze * 0.72;

    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`

export type MembraneOptions = {
  base: string
  rim: string
  /** Alpha of the flat, face-on part of the surface. */
  opacity?: number
  /** Extra alpha added at grazing angles. */
  rimStrength?: number
  /** Higher = tighter, brighter rim. */
  rimPower?: number
  /** Adds glow that the bloom pass will pick up. */
  emissive?: number
  side?: THREE.Side
  /** Scales the distance haze. 0 disables it — for things that must stay legible. */
  fogAmount?: number
  /** Fades alpha towards the UV border. For open sheets, not closed shells. */
  edgeFade?: number
  /** Amplitude of the idle surface wobble, in world units. */
  wobble?: number
  wobbleFreq?: number
  depthWrite?: boolean
}

export class MembraneMaterial extends THREE.ShaderMaterial {
  constructor(opts: MembraneOptions) {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: opts.depthWrite ?? false,
      side: opts.side ?? THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uBase: { value: new THREE.Color(opts.base) },
        uRim: { value: new THREE.Color(opts.rim) },
        uOpacity: { value: opts.opacity ?? 0.18 },
        uRimStrength: { value: opts.rimStrength ?? 0.55 },
        uRimPower: { value: opts.rimPower ?? 2.4 },
        uEmissive: { value: opts.emissive ?? 0.25 },
        uDim: { value: 1 },
        uEdgeFade: { value: opts.edgeFade ?? 0 },
        uTime: { value: 0 },
        uWobble: { value: opts.wobble ?? 0 },
        uWobbleFreq: { value: opts.wobbleFreq ?? 1.2 },
        uLightDir: { value: new THREE.Vector3(0.4, 0.9, 0.55).normalize() },
        uFogColor: { value: new THREE.Color(FOG.color) },
        uFogNear: { value: FOG.near },
        uFogFar: { value: FOG.far },
        uFogAmount: { value: opts.fogAmount ?? 1 },
      },
    })
  }

  set time(t: number) {
    this.uniforms.uTime.value = t
  }
  get dim() {
    return this.uniforms.uDim.value as number
  }
  set dim(d: number) {
    this.uniforms.uDim.value = d
  }
}

export function useMembraneMaterial(opts: MembraneOptions) {
  return useMemo(
    () => new MembraneMaterial(opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.base, opts.rim, opts.opacity, opts.rimStrength, opts.rimPower, opts.emissive, opts.side, opts.wobble, opts.wobbleFreq, opts.depthWrite, opts.edgeFade, opts.fogAmount],
  )
}

/**
 * Small solid bodies (ribosomes, proteins, ATP) use a cheap lit material instead
 * of the shell shader — there are thousands of them and they read as dots.
 */
export function useSolidMaterial(color: string, opts: { emissive?: number; opacity?: number; flatShading?: boolean } = {}) {
  return useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.55,
      metalness: 0.0,
      emissive: new THREE.Color(color),
      emissiveIntensity: opts.emissive ?? 0.18,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
      flatShading: opts.flatShading ?? false,
    })
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, opts.emissive, opts.opacity, opts.flatShading])
}
