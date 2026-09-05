import { Backdrop } from './Backdrop'
import { CameraRig } from './CameraRig'
import { CellClockDriver } from './clock'
import { Cell } from './Cell'
import { DevBridge } from './DevBridge'
import { Effects } from './Effects'
import { FOG } from '../lib/materials'

export function Scene() {
  return (
    <>
      {/* Drives the shared biological clock; must tick before anything reads it. */}
      <CellClockDriver />
      {/* Depth cue for the solid bodies. The shell shader cannot use this — it is
          a raw ShaderMaterial — so it reimplements the same curve from FOG. */}
      <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
      <Backdrop />
      {/* Soft, mostly ambient lighting: cells have no sun, and hard shadows
          would fight the translucency that carries the whole look. */}
      <ambientLight intensity={0.75} color="#cfe0e6" />
      <hemisphereLight args={['#e8f2f0', '#243040', 0.7]} />
      <directionalLight position={[12, 18, 10]} intensity={1.0} color="#fff4e2" />
      <directionalLight position={[-14, -6, -10]} intensity={0.45} color="#9fc7d8" />
      <pointLight position={[0, 0, 0]} intensity={12} distance={22} decay={2} color="#8fb7c4" />
      <CameraRig />
      {import.meta.env.DEV && <DevBridge />}
      <Cell />
      <Effects />
    </>
  )
}
