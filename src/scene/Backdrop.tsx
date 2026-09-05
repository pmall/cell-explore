import { useMemo } from 'react'
import * as THREE from 'three'
import { palette } from '../theme/palette'

/**
 * The world outside the cell. A gradient sphere rather than a flat clear colour,
 * so the bloom pass has something to sit against and the cell reads as
 * suspended in fluid rather than floating in a void.
 */
export function Backdrop() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color(palette.cytosol) },
          uBottom: { value: new THREE.Color(palette.void) },
          uGlow: { value: new THREE.Color('#1d3040') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform vec3 uGlow;
          varying vec3 vDir;
          void main() {
            float h = vDir.y * 0.5 + 0.5;
            vec3 col = mix(uBottom, uTop, smoothstep(0.15, 0.9, h));
            // A soft pool of light above and behind, to give the scene a key.
            float key = pow(max(0.0, dot(normalize(vDir), normalize(vec3(0.3, 0.8, 0.5)))), 3.0);
            col += uGlow * key * 0.5;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )

  const geometry = useMemo(() => new THREE.SphereGeometry(220, 32, 24), [])

  return <mesh geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
}
