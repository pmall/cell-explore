import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Scene } from './scene/Scene'
import { Overlay } from './ui/Overlay'

export function App() {
  return (
    <div className="app">
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1.15,
        }}
        camera={{ position: [14, 8, 19], fov: 45, near: 0.05, far: 500 }}
      >
        <Scene />
      </Canvas>
      <Overlay />
    </div>
  )
}
