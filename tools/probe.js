// Geometry/perf census. node tools/shoot.mjs probe tools/probe.js
(() => {
  const scene = window.__scene
  if (!scene) return 'no scene (dev build only)'
  let meshes = 0, tris = 0, instanced = 0
  const heavy = []
  scene.traverse((o) => {
    if (!o.isMesh) return
    meshes++
    const g = o.geometry
    g.computeBoundingSphere?.()
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3
    const count = o.isInstancedMesh ? o.count : 1
    if (o.isInstancedMesh) instanced += o.count
    tris += n * count
    if (n * count > 8000) {
      heavy.push(`${Math.round(n * count)} tris x${count} r=${g.boundingSphere?.radius?.toFixed(2)}`)
    }
  })
  return { fps: Math.round(window.__fps || 0), meshes, instancedTotal: instanced,
           triangles: Math.round(tris), heavy: heavy.sort() }
})()
