// Offline PWA Flight Simulation Test for Heirloom
// Verifies that when disconnected from the network (airplane mode / grocery basement / off-grid kitchen),
// the Service Worker serves precached bundles, pages, and recipe API responses seamlessly.
//
// Usage:
//   pnpm run build && node scripts/e2e-offline-flight.js
//
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

let assertions = 0
function assert(condition, message) {
  assertions++
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(message)
  }
}

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  if (existsSync(chromium.executablePath())) return undefined
  const cache = join(homedir(), '.cache/ms-playwright')
  const builds = existsSync(cache)
    ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()
    : []
  for (const build of builds) {
    const binary = join(cache, build, 'chrome-linux64/chrome')
    if (existsSync(binary)) return binary
  }
  for (const binary of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(binary)) return binary
  }
  throw new Error('No Chromium found. Run `pnpm exec playwright install chromium` or set CHROMIUM_PATH.')
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function startServer() {
  if (process.env.E2E_BASE_URL) return { base: process.env.E2E_BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  const entry = join(ROOT, '.output/server/index.mjs')
  if (!existsSync(entry)) throw new Error('Missing .output/ — run `pnpm run build` first.')
  const dir = mkdtempSync(join(tmpdir(), 'heirloom-offline-'))
  const database = join(dir, 'heirloom.db')
  const sqlite = new Database(database)
  migrate(drizzle(sqlite), { migrationsFolder: join(ROOT, 'server/db/migrations') })
  sqlite.close()

  const port = Number(process.env.E2E_PORT) || await freePort()
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), DATABASE_URL: database, E2E_TEST: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let log = ''
  child.stdout.on('data', chunk => { log += chunk })
  child.stderr.on('data', chunk => { log += chunk })

  const stop = async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await new Promise(resolve => child.once('exit', resolve))
    }
    rmSync(dir, { recursive: true, force: true })
  }

  const base = `http://127.0.0.1:${port}`
  try {
    let response
    for (let attempt = 0; attempt < 80 && !response; attempt++) {
      if (child.exitCode !== null) throw new Error('Server exited early:\n' + log)
      response = await fetch(base + '/api/recipes').catch(() => undefined)
      if (!response) await sleep(250)
    }
    if (!response || !response.ok) throw new Error('Server did not become healthy in time:\n' + log)
  } catch (error) {
    await stop()
    throw error
  }
  return { base, stop }
}

async function runOfflineFlight() {
  console.log('🚀 Starting Heirloom Offline PWA Flight Simulation...\n')
  const server = await startServer()
  const base = server.base

  // Seed starter recipes (requires same-origin headers)
  const seedRes = await fetch(base + '/api/recipes/seed', {
    method: 'POST',
    headers: { 'Origin': base, 'Referer': base }
  })
  if (!seedRes.ok) {
    const text = await seedRes.text()
    console.error(`Seed failed with HTTP ${seedRes.status}: ${text}`)
  }
  assert(seedRes.ok, 'Seed endpoint should respond 200/201 OK')
  const recipesList = await (await fetch(base + '/api/recipes')).json()
  assert(recipesList.length >= 5, `Expected >= 5 recipes, got ${recipesList.length}`)
  const targetRecipe = recipesList[0]
  console.log(`📌 Seeded test recipes. Target recipe: "${targetRecipe.title}" (ID: ${targetRecipe.id})`)

  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    headless: true
  })

  try {
    // Enable Service Workers on context
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      serviceWorkers: 'allow'
    })

    const page = await context.newPage()

    const pageErrors = []
    page.on('pageerror', err => pageErrors.push(`pageerror: ${err.message}`))
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignore expected net::ERR_INTERNET_DISCONNECTED when offline mode is deliberately engaged
        if (!text.includes('ERR_INTERNET_DISCONNECTED') && !text.includes('Failed to load resource')) {
          pageErrors.push(`console error: ${text}`)
        }
      }
    })

    // Step 1: Online warm-up and Service Worker registration
    console.log('\n[Phase 1] Online Warm-Up & Cache Priming...')
    await page.goto(`${base}/recipes`)
    await page.waitForLoadState('networkidle')

    // Wait for Service Worker registration to be active and controlling
    console.log('  · Waiting for Service Worker activation...')
    const swActive = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const reg = await navigator.serviceWorker.ready
      return !!reg.active
    })
    assert(swActive, 'Service Worker should be registered and active')
    console.log('  ✔ Service Worker active and ready')

    // Warm /recipes, recipe detail and kitchen mode while online under active SW
    console.log('  · Warming cache for /recipes...')
    await page.goto(`${base}/recipes`)
    await page.waitForLoadState('networkidle')

    console.log(`  · Warming cache for recipe "${targetRecipe.title}" via client navigation...`)
    const recipeLink = page.getByRole('link', { name: targetRecipe.title }).first()
    await recipeLink.click()
    await page.waitForURL(`**/recipes/${targetRecipe.id}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('heading', { name: targetRecipe.title }).waitFor()

    console.log('  · Warming cache for Kitchen Mode via client navigation...')
    const cookLink = page.getByRole('link', { name: /Start cooking|Cook/i }).first()
    await cookLink.click()
    await page.waitForURL(`**/recipes/${targetRecipe.id}/cook`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('heading', { level: 1 }).waitFor()

    // Also navigate back to /recipes to ensure full journey is primed
    console.log('  · Exiting Kitchen Mode back to recipe and catalog...')
    const exitKitchenLink = page.getByRole('link', { name: /Exit kitchen/i })
    await exitKitchenLink.click()
    await page.waitForURL(`**/recipes/${targetRecipe.id}`)
    await page.waitForLoadState('networkidle')

    const recipesTopLink = page.getByRole('link', { name: /^Recipes$/i }).first()
    await recipesTopLink.click()
    await page.waitForURL(`**/recipes`)
    await page.waitForLoadState('networkidle')
    const swDiagnostics = await page.evaluate(async () => {
      const keys = await caches.keys()
      const entries = {}
      for (const k of keys) {
        const cache = await caches.open(k)
        const requests = await cache.keys()
        entries[k] = requests.map(r => r.url)
      }
      return {
        controller: !!navigator.serviceWorker.controller,
        caches: entries
      }
    })
    console.log('  SW Diagnostics: controller =', swDiagnostics.controller, 'cache names =', Object.keys(swDiagnostics.caches))
    for (const [name, urls] of Object.entries(swDiagnostics.caches)) {
      console.log(`    [${name}]: ${urls.length} items (sample: ${urls.slice(0, 3).join(', ')})`)
    }

    // Step 2: Cut network connection completely
    console.log('\n[Phase 2] Engaging Offline Mode (Airplane / Off-grid Kitchen Simulation)...')
    await context.setOffline(true)
    console.log('  ✈ Network status: OFFLINE')

    // Step 3: Offline navigation - Recipe Catalog
    console.log('\n[Phase 3] Offline Verification: Recipe Catalog...')
    await page.goto(`${base}/recipes`)
    await page.waitForSelector('article')
    const articleCount = await page.locator('article').count()
    assert(articleCount >= 5, `Offline recipe catalog should render cached recipes (found ${articleCount})`)
    const recipeHeading = page.getByRole('heading', { name: targetRecipe.title }).first()
    await recipeHeading.waitFor()
    console.log(`  ✔ Offline catalog verified: rendered ${articleCount} recipe cards`)

    // Step 4: Offline navigation - Recipe Detail Page
    console.log('\n[Phase 4] Offline Verification: Recipe Detail View...')
    const offlineRecipeLink = page.getByRole('link', { name: targetRecipe.title }).first()
    await offlineRecipeLink.click()
    await page.waitForURL(`**/recipes/${targetRecipe.id}`)
    console.log(`  · Current URL after click: ${page.url()}`)
    await page.locator('.ingredient-row').first().waitFor({ timeout: 5000 })
    // Verify ingredients and steps are intact from cache
    const ingredientItems = await page.locator('.ingredient-row').count()
    assert(ingredientItems > 0, 'Offline recipe detail must display ingredients from cache')
    console.log(`  ✔ Offline recipe view verified: title & ${ingredientItems} ingredients rendered`)

    // Step 5: Offline navigation - Kitchen Cooking Mode & Knuckle HUD Controls
    console.log('\n[Phase 5] Offline Verification: Kitchen Companion Mode...')
    const startCookingLink = page.getByRole('link', { name: /Start cooking|Cook/i }).first()
    await startCookingLink.click()
    await page.waitForURL(`**/recipes/${targetRecipe.id}/cook`)

    // Verify Kitchen Mode loaded offline
    console.log('  · Verifying Kitchen Mode Prep view loaded offline...')
    await page.getByRole('heading', { name: /Prep & Mise en Place/i }).waitFor()

    // Transition from Prep to Step 1
    const startCookingBtn = page.getByRole('button', { name: /Start Cooking|Skip prep/i }).first()
    await startCookingBtn.click()

    // Verify Step 1 is rendered
    console.log('  · Verifying cooking step navigation offline...')
    await page.getByText(/Step 1 of/i).first().waitFor()

    const nextBtn = page.getByRole('button', { name: 'Next' })
    await nextBtn.waitFor()

    // Test Knuckle HUD touch target size in kitchen mode (>= 56px)
    const btnHeight = await nextBtn.evaluate(el => el.getBoundingClientRect().height)
    assert(btnHeight >= 56, `Knuckle touch target should be >= 56px, got ${btnHeight}px`)

    // Test offline reactivity: advance to Step 2
    await nextBtn.click()
    await page.getByText(/Step 2 of/i).first().waitFor()
    console.log(`  ✔ Offline Kitchen Mode verified: Prep → Step 1 → Step 2 with ${btnHeight}px knuckle controls`)

    // Test offline speech HUD toggle (should not crash offline)
    const speakBtn = page.locator('.speak-button')
    if (await speakBtn.count() > 0) {
      await speakBtn.click()
      await sleep(150)
      await speakBtn.click()
    }

    // Step 6: Verify no unhandled page crashes occurred during offline operation
    assert(pageErrors.length === 0, `Page errors detected during offline flight:\n${pageErrors.join('\n')}`)
    console.log('  ✔ Zero unhandled page errors or script crashes during offline flight')

    // Step 7: Restore network connection
    console.log('\n[Phase 6] Restoring Online Connectivity...')
    await context.setOffline(false)
    console.log('  ✔ Network restored to ONLINE')

    await context.close()
  } finally {
    await browser.close()
    await server.stop()
  }

  console.log(`\n🎉 PWA Offline Flight Simulation Passed! (${assertions} assertions green)\n`)
}

runOfflineFlight().catch(err => {
  console.error('\n❌ Offline Flight Simulation Failed:', err)
  process.exit(1)
})
