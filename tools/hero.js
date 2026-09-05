/**
 * Camera setup for the README hero image (docs/cell.png):
 *
 *   URL=http://localhost:5178/ W=1600 H=1000 WAIT=6000 \
 *     node tools/shoot.mjs cell tools/hero.js && mv shots/cell.png docs/cell.png
 *
 * Just the default overview framing with the intro dismissed and the biology
 * left running long enough for the mechanisms to be mid-cycle rather than at
 * their start poses.
 */
;(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  window.__store.getState().dismissIntro()
  await wait(4000)
})()
