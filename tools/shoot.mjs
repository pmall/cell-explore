/**
 * Screenshot harness. Drives the system Chromium through Playwright, optionally
 * running a script in the page first, and writes a PNG to shots/.
 *
 *   node tools/shoot.mjs <name> [script.js]
 *
 * The optional script is evaluated as an expression (write it as an IIFE, and
 * make it async if it needs to wait). In dev builds `window.__store`,
 * `window.__scene`, `window.__camera`, `window.__gl` and `window.__fps` are
 * exposed by src/scene/DevBridge.tsx — driving the store directly is far more
 * reliable than clicking DOM buttons.
 *
 * Env: URL (default http://localhost:5178/), W, H, WAIT (ms after the script).
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const [, , outName = 'shot', scriptFile = ''] = process.argv

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/snap/bin/chromium',
  // Software GL: there is no GPU in this environment, so expect 1-2 fps. That
  // is a harness limitation, not the app's frame rate.
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
})
const page = await browser.newPage({
  viewport: { width: Number(process.env.W) || 1600, height: Number(process.env.H) || 1000 },
})

const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

await page.goto(process.env.URL || 'http://localhost:5178/', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)

let result = null
if (scriptFile && fs.existsSync(scriptFile)) {
  try {
    result = await page.evaluate(fs.readFileSync(scriptFile, 'utf8'))
  } catch (e) {
    logs.push(`[evalerror] ${e.message}`)
  }
  await page.waitForTimeout(Number(process.env.WAIT) || 2500)
}

fs.mkdirSync(path.join(root, 'shots'), { recursive: true })
await page.screenshot({ path: path.join(root, 'shots', `${outName}.png`) })

const noise = /GL Driver|\[vite\]|DevTools|gcm\/engine|THREE\.Clock/
console.log('--- console ---')
console.log(logs.filter((l) => !noise.test(l)).slice(0, 40).join('\n') || '(clean)')
if (result !== null) console.log('--- result ---\n' + JSON.stringify(result, null, 2))
await browser.close()
