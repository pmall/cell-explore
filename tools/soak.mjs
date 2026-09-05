/**
 * Clicks through every tour step, every structure and every toggle, and reports
 * any exception or console error. Run it after any change that touches the
 * scene graph, the store, or a mechanism. Takes a few minutes on software GL.
 *
 *   node tools/soak.mjs
 */
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/snap/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
})
// Small viewport: this run is about catching exceptions, not looking at pixels.
const page = await browser.newPage({ viewport: { width: 640, height: 400 } })

const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(`[console] ${m.text()}`)
})

await page.goto(process.env.URL || 'http://localhost:5178/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

const result = await page.evaluate(async () => {
  const store = window.__store
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  store.getState().setQuality('low') // skip the bloom pass; this is a logic soak
  store.getState().dismissIntro()

  const tours = ['firstLook', 'centralDogma', 'secretory', 'bioenergetics', 'signalling', 'trafficking']
  let steps = 0
  for (const id of tours) {
    store.getState().startTour(id)
    for (let i = 0; i < 6; i++) { store.getState().goToStep(i); steps++; await wait(60) }
  }
  store.getState().exitTour()

  const structures = ['plasmaMembrane','membraneProteins','cytosol','nucleus','nuclearPore',
    'nucleolus','chromatin','roughER','smoothER','ribosome','golgi','vesicle',
    'mitochondrion','lysosome','peroxisome','microtubule','actin','centrosome']
  for (const s of structures) { store.getState().select(s); await wait(50) }
  store.getState().select(null)

  for (const sp of [0, 0.5, 2, 1]) { store.getState().setSpeed(sp); await wait(80) }
  store.getState().setQuality('high'); await wait(600)

  return { tours: tours.length, stepTransitions: steps, structures: structures.length }
})

await page.waitForTimeout(1500)
console.log(JSON.stringify(result))
console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none')
await browser.close()
