// End-to-end user-flow journey for Heirloom (docs/USER_FLOWS.md).
//
//   pnpm run build && node scripts/e2e-user-flows.js
//
// By default each viewport gets its own production server (`.output/`) on a fresh temporary
// SQLite database, so Flow 1 always starts from an empty cookbook. Set E2E_BASE_URL to drive an
// already running app instead (starter recipes are then seeded through the idempotent API).
// Chromium: CHROMIUM_PATH, else Playwright's own browser, else the newest cached ms-playwright build.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
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
const SHOTS = join(ROOT, 'docs/screenshots/e2e-flow')
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, isMobile: false },
  { name: 'mobile', width: 375, height: 812, isMobile: true }
]
const STARTERS = ['Arni me Patates', 'Traditional Spanakopita', 'Santorini Fava', 'Classic Fasolada', 'Revani with Citrus Syrup']

const report = { steps: 0, assertions: 0, screenshots: [], failures: [] }

function assert(condition, message) {
  report.assertions++
  if (!condition) throw new Error(message)
}

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  if (existsSync(chromium.executablePath())) return undefined
  const cache = join(homedir(), '.cache/ms-playwright')
  const builds = existsSync(cache) ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse() : []
  for (const build of builds) {
    const binary = join(cache, build, 'chrome-linux64/chrome')
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
  const dir = mkdtempSync(join(tmpdir(), 'heirloom-e2e-'))
  const database = join(dir, 'heirloom.db')
  // Documented setup: migrate first (docker/entrypoint.sh does the same). The server's boot-time
  // migration plugin cannot find server/db/migrations from inside the .output bundle.
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
    if (!response) throw new Error('Server did not start listening:\n' + log)
    if (!response.ok) throw new Error(`Server is up but unhealthy (GET /api/recipes → ${response.status}):\n` + log)
  } catch (error) {
    await stop()
    throw error
  }
  return { base, stop }
}

function watch(page, viewport) {
  const problems = []
  page.on('console', message => { if (message.type() === 'error') problems.push(`console: ${message.text()}`) })
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
  page.on('requestfailed', request => {
    // Navigations and SSE readers aborted by the app itself are expected (e.g. leaving a page).
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') problems.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`)
  })
  page.on('response', response => { if (response.status() >= 500) problems.push(`HTTP ${response.status()}: ${response.url()}`) })
  return () => {
    if (problems.length) throw new Error(`${viewport.name}: ${problems.length} browser error(s):\n  ` + problems.join('\n  '))
  }
}

async function assertLayout(page, viewport, where) {
  const layout = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 2 && rect.height > 2 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('.sr-only, dialog:not([open])')
    }
    const controls = [...document.querySelectorAll('a, button, select, summary, input:not([type=hidden]):not([type=checkbox]):not([type=radio])')].filter(visible)
    const tabs = [...document.querySelectorAll('.tab-bar .tab')].filter(visible)
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      small: controls.filter(element => element.getBoundingClientRect().height < 43.5)
        .map(element => (element.innerText || element.getAttribute('aria-label') || element.tagName).trim().slice(0, 30)),
      tabs: tabs.length,
      current: tabs.filter(tab => tab.getAttribute('aria-current') === 'page').length,
      topNav: [...document.querySelectorAll('.app-top-bar nav a')].filter(visible).length,
      kitchen: !!document.querySelector('.kitchen-top')
    }
  })
  assert(!layout.overflow, `${where}: horizontal overflow at ${viewport.width}px`)
  assert(layout.small.length === 0, `${where}: touch targets under 44px: ${layout.small.join(', ')}`)
  if (!layout.kitchen) {
    if (viewport.width < 768) assert(layout.tabs === 5, `${where}: mobile tab bar should show 5 tabs, saw ${layout.tabs}`)
    else assert(layout.topNav === 6 && layout.tabs === 0, `${where}: desktop should show 5 tabs plus Market in the top nav and no tab bar, saw ${layout.topNav}`)
  }
}

async function shot(page, viewport, slug, locator) {
  // Park the subject just below the sticky top bar (57px app / 62px kitchen) so headings are not clipped.
  if (locator) await locator.first().evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 88))
  const file = `${viewport.name}-${String(report.screenshots.length + 1).padStart(2, '0')}-${slug}.png`
  await page.screenshot({ path: join(SHOTS, file) })
  report.screenshots.push(file)
}

async function step(page, viewport, name, action) {
  report.steps++
  process.stdout.write(`  · [${viewport.name}] ${name} … `)
  await action()
  await assertLayout(page, viewport, name)
  console.log('ok')
}

async function swipe(page, locator, dx) {
  await locator.evaluate((element, distance) => {
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + 40
    const touch = at => new Touch({ identifier: 1, target: element, clientX: at, clientY: y })
    element.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(x)], changedTouches: [touch(x)], bubbles: true }))
    for (let i = 1; i <= 6; i++) {
      const at = x + distance * i / 6
      element.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(at)], changedTouches: [touch(at)], bubbles: true }))
    }
    element.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(x + distance)], bubbles: true }))
  }, dx)
}

async function journey(browser, viewport) {
  const server = await startServer()
  const base = server.base
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: true,
    serviceWorkers: 'block',
    permissions: ['clipboard-read', 'clipboard-write']
  })
  // Model a browser that refuses the first wake-lock request (no user gesture yet) and grants later ones.
  await context.addInitScript(() => {
    let calls = 0
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
      if (++calls === 1) throw new DOMException('A user gesture is required', 'NotAllowedError')
      const sentinel = new EventTarget()
      Object.assign(sentinel, { released: false, type: 'screen', release: async () => { sentinel.released = true; sentinel.dispatchEvent(new Event('release')) } })
      return sentinel
    } } })
  })
  const page = await context.newPage()
  const verifyClean = watch(page, viewport)
  const dialogs = []
  page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.accept() })
  const go = async path => {
    await page.goto(base + path)
    await page.waitForLoadState('networkidle')
  }
  const tap = locator => locator.click()
  let arniUrl = ''

  try {
    // Flow 1 — Landing → first-run Greek starter pack
    await step(page, viewport, 'Flow 1 · landing page', async () => {
      await go('/')
      await page.getByRole('heading', { level: 1 }).waitFor()
      await shot(page, viewport, 'landing')
    })
    await step(page, viewport, 'Flow 1 · open cookbook, empty state', async () => {
      await tap(page.getByRole('link', { name: 'Open your cookbook' }))
      await page.waitForURL('**/recipes')
      await page.waitForLoadState('networkidle')
      const starter = page.getByRole('button', { name: /Load Starter Heirloom Recipes/ })
      if (!process.env.E2E_BASE_URL) {
        // Fresh isolated database: the first-run empty state and its starter action must appear.
        await page.getByText('Every collection starts with one recipe.').waitFor()
        await starter.waitFor()
        await shot(page, viewport, 'recipes-empty-state')
        await tap(starter)
      } else if (await page.evaluate(async () => (await (await fetch('/api/recipes')).json()).length === 0)) {
        await starter.waitFor()
        await tap(starter)
      } else {
        // Existing cookbook: the seed endpoint is an idempotent no-op once recipes exist.
        await page.evaluate(() => fetch('/api/recipes/seed', { method: 'POST' }))
        await page.reload()
      }
      for (const title of STARTERS) await page.getByRole('heading', { name: title }).first().waitFor()
      assert(await page.locator('article').count() >= STARTERS.length, 'Starter pack should show at least 5 recipe cards')
      await shot(page, viewport, 'starter-pack-loaded')
    })

    // Flow 2 — Import from every source: web URL, video link, scanned card (OCR) and memory → save → metric assistant.
    // Web and video sources are offline fixtures served by safeFetch because the server runs with E2E_TEST=true.
    const importDraft = async (tab, label, value, provenance) => {
      await tap(page.getByRole('button', { name: tab, exact: true }))
      await page.getByLabel(label, { exact: true }).fill(value)
      await tap(page.getByRole('button', { name: 'Create recipe draft' }))
      await page.getByRole('button', { name: 'Save to Cookbook' }).waitFor({ timeout: 20000 })
      const draft = page.locator('article')
      assert((await draft.locator('.meta-label').innerText()).includes(provenance), `${tab} draft should cite "${provenance}"`)
      return draft
    }
    await step(page, viewport, 'Flow 2 · import from a web URL', async () => {
      await tap(page.getByRole('link', { name: 'Import Recipe' }).first())
      await page.waitForURL('**/recipes/import')
      const draft = await importDraft('Web URL', 'Recipe URL', 'https://fixtures.heirloom.test/recipe.html', 'Recipe JSON-LD · extracted')
      assert(await draft.getByLabel('Recipe title').inputValue() === 'Fasolakia Ladera', 'Web import should keep the JSON-LD recipe name')
      assert((await draft.innerText()).includes('500 g green beans'), 'Web import should keep source measurements')
      assert(await draft.getByText('40 min timer', { exact: true }).count() === 1 && await draft.getByText('low heat', { exact: true }).count() === 1, 'Web import should time the simmer step and show its heat')
      await shot(page, viewport, 'import-web-url', page.getByRole('button', { name: 'Save to Cookbook' }))
    })
    await step(page, viewport, 'Flow 2 · import from a video link', async () => {
      const draft = await importDraft('Video Link', 'YouTube URL or video ID', 'https://www.youtube.com/watch?v=TESTVIDEO11', 'Video description & timestamps (captions unavailable) · parsed sections')
      assert(await draft.getByLabel('Recipe title').inputValue() === 'Patates Lemonates', 'Video import should use the video title')
      assert(await draft.locator('ol > li').count() === 3, 'Video import should parse the three numbered steps from the description')
      assert(await draft.getByText('1 h timer', { exact: true }).count() === 1 && await draft.getByText('5 min timer', { exact: true }).count() === 1, 'Video import should show timer badges for the roast and rest')
      assert(await page.getByText(/doesn’t have captions/).count() === 1, 'Captionless video import should explain that the recipe came from the creator’s notes and timestamps')
      await shot(page, viewport, 'import-video-link', page.getByRole('button', { name: 'Save to Cookbook' }))
    })
    await step(page, viewport, 'Flow 2 · import a scanned recipe card (OCR)', async () => {
      const card = 'Yiayia’s Koulourakia\nEaster butter cookies from the tin by the stove.\n\nIngredients\n250 g butter\n200 g sugar\n3 eggs\n1 kg flour\n\nMethod\n1. Cream\nBeat the butter and sugar until pale.\n2. Shape\nAdd the eggs and flour, then roll into twists.\n3. Bake\nBake at 180°C for 20 minutes until golden.'
      const draft = await importDraft('Scanned Card / Photo OCR', 'Scanned card text', card, 'Scanned recipe card / OCR · parsed sections')
      assert(await draft.getByLabel('Recipe title').inputValue() === 'Yiayia’s Koulourakia', 'OCR import should take the title from the first line')
      await shot(page, viewport, 'import-ocr-card', page.getByRole('button', { name: 'Save to Cookbook' }))
      await tap(page.getByRole('button', { name: 'Save to Cookbook' }))
      await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/)
      const saved = await page.evaluate(async () => (await (await fetch('/api' + location.pathname)).json()).sourceType)
      assert(saved === 'handwritten_ocr', 'Saved OCR recipe should keep sourceType handwritten_ocr, got ' + saved)
      await page.getByRole('heading', { name: 'Yiayia’s Koulourakia' }).waitFor()
    })
    const cardPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGP4+vICVsQwtCQAC/WrgRhc/2MAAAAASUVORK5CYII=', 'base64')
    await step(page, viewport, 'Flow 2 · import a photographed recipe card', async () => {
      await go('/recipes/import')
      await tap(page.getByRole('button', { name: 'Scanned Card / Photo OCR', exact: true }))
      const captureAttrs = await page.getByLabel('Recipe card photo').evaluate(el => [el.getAttribute('capture'), el.getAttribute('accept')])
      assert(captureAttrs[0] === 'environment' && captureAttrs[1] === 'image/*', 'Photo input should open the rear camera and accept images')
      await page.getByLabel('Recipe card photo').setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: cardPng })
      await page.getByRole('img', { name: 'Photo of your recipe card' }).waitFor()
      await shot(page, viewport, 'import-photo-preview', page.getByRole('button', { name: 'Remove photo' }))
      await tap(page.getByRole('button', { name: 'Remove photo' }))
      assert(await page.getByRole('img', { name: 'Photo of your recipe card' }).count() === 0, 'Remove photo should clear the preview')
      await page.getByLabel('Recipe card photo').setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: cardPng })
      await page.getByRole('img', { name: 'Photo of your recipe card' }).waitFor()
      await tap(page.getByRole('button', { name: 'Create recipe draft' }))
      await page.getByRole('button', { name: 'Save to Cookbook' }).waitFor({ timeout: 20000 })
      assert(await page.locator('img[alt="Photographed recipe card"]').count() === 1, 'Comparison panel should show the photographed card')
      await tap(page.getByRole('button', { name: 'Save to Cookbook' }))
      await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/)
      const image = await page.evaluate(async () => (await (await fetch('/api' + location.pathname)).json()).imageUrl)
      assert(typeof image === 'string' && image.startsWith('data:image/jpeg;base64,'), 'Saved recipe should keep the card photo as imageUrl')
      const listed = await page.evaluate(async () => {
        const response = await fetch('/api/recipes'), text = await response.text()
        const row = JSON.parse(text).find(item => item.imageUrl?.startsWith('/api/recipes/'))
        const photo = row && await fetch(row.imageUrl)
        return { bytes: text.length, url: row?.imageUrl, type: photo?.headers.get('content-type'), cache: photo?.headers.get('cache-control'), size: photo ? (await photo.arrayBuffer()).byteLength : 0 }
      })
      assert(listed.url && listed.type === 'image/jpeg' && listed.size > 0 && /immutable/.test(listed.cache), 'Recipe list should point at a cacheable image endpoint that serves the photo')
      assert(!listed.bytes || listed.bytes < 100000, 'Recipe list payload should stay small, got ' + listed.bytes)
      await go('/recipes')
      const rendered = await page.locator('img[src*="/image?v="]').first().evaluate(img => img.complete ? img.naturalWidth : new Promise(resolve => { img.onload = () => resolve(img.naturalWidth); img.onerror = () => resolve(0) }))
      assert(rendered > 0, 'Recipe card should render the photo from the image endpoint')
    })
    await step(page, viewport, 'Flow 1 · curated collection filter', async () => {
      // Guarantee a ≤ 30 min recipe exists so the filter has something to include and something to exclude.
      await page.evaluate(async () => {
        const quick = (await (await fetch('/api/recipes?collection=quick')).json()).length
        if (!quick) await fetch('/api/recipes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Ten-Minute Horiatiki', description: 'A weeknight salad.', servings: 2, totalTimeMinutes: 10, difficulty: 'easy' }) })
      })
      await go('/recipes')
      const articles = page.locator('article')
      await articles.first().waitFor()
      const total = await articles.count()
      const expected = await page.evaluate(async () => (await (await fetch('/api/recipes?collection=quick')).json()).length)
      assert(expected > 0 && expected < total, `Weeknight collection should narrow the list (${expected} of ${total})`)
      const pill = page.getByRole('group', { name: 'Curated collections' }).getByRole('button', { name: /Weeknight/ })
      const box = await pill.boundingBox()
      assert(box && box.height >= 44, 'Collection pills need a 44px touch target, got ' + box?.height)
      await tap(pill)
      assert(await pill.getAttribute('aria-pressed') === 'true', 'Weeknight pill should be pressed')
      await page.waitForFunction(count => document.querySelectorAll('article').length === count, expected)
      const badges = await articles.evaluateAll(cards => cards.filter(card => /⚡ Quick/.test(card.textContent)).length)
      assert(badges === expected, `Every weeknight card should carry the Quick badge (${badges}/${expected})`)
      await shot(page, viewport, 'recipes-collection-weeknight')
      await tap(page.getByRole('group', { name: 'Curated collections' }).getByRole('button', { name: 'All Collections' }))
      await page.waitForFunction(count => document.querySelectorAll('article').length === count, total)
    })
    await step(page, viewport, 'Flow 2 · import a recipe from memory', async () => {
      await go('/recipes/import')
      await tap(page.getByRole('button', { name: 'Conversational Memory' }))
      await page.getByLabel('What do you remember?').fill('Γιαγιάς lemon chicken, roasted on Sundays with oregano and potatoes')
      await tap(page.getByRole('button', { name: 'Create recipe draft' }))
      await page.getByRole('button', { name: 'Save to Cookbook' }).waitFor({ timeout: 20000 })
      assert((await page.locator('article').innerText()).includes('[Inferred by AI]'), 'Offline draft should label inferred quantities')
      await shot(page, viewport, 'import-draft', page.getByRole('button', { name: 'Save to Cookbook' }))
    })
    await step(page, viewport, 'Flow 2 · save draft to cookbook', async () => {
      await tap(page.getByRole('button', { name: 'Save to Cookbook' }))
      await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/)
      await page.getByRole('link', { name: 'Start cooking' }).waitFor()
      await shot(page, viewport, 'imported-recipe')
    })
    await step(page, viewport, 'Flow 2 · metric conversion assistant', async () => {
      await go('/recipes')
      await tap(page.getByRole('link', { name: 'Arni me Patates' }).first())
      await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/)
      arniUrl = new URL(page.url()).pathname
      const panel = page.getByRole('region', { name: 'Suggest Metric Conversions (g/ml)' })
      await panel.waitFor()
      assert((await panel.innerText()).includes('Greek fine sea salt'), 'Assistant should suggest a gram weight for the teaspoon salt')
      await shot(page, viewport, 'metric-assistant', panel)
      await tap(panel.getByRole('button', { name: 'Apply to recipe' }))
      await panel.waitFor({ state: 'detached' })
      const ingredients = await page.getByRole('heading', { name: 'Ingredients' }).locator('xpath=..').innerText()
      assert(/\d+(\.\d+)? g Greek fine sea salt/.test(ingredients), 'Salt should now be listed in grams')
      await shot(page, viewport, 'metric-applied')
    })

    // Flow 3 — Kitchen Mode: swipe, timers, heat panel, rescue, exit guard
    await step(page, viewport, 'Flow 3 · enter Kitchen Mode', async () => {
      // Scale on the recipe page; the choice follows the cook into Kitchen Mode.
      const servingsInput = page.locator('#servings-input')
      const original = Number(await servingsInput.inputValue())
      const firstQuantity = async () => Number((await page.locator('.ingredient-row').first().innerText()).match(/[\d.]+/)[0])
      const before = await firstQuantity()
      await tap(page.getByRole('group', { name: 'Scale recipe' }).getByRole('button', { name: '2×' }))
      assert(Number(await servingsInput.inputValue()) === original * 2, 'The 2× preset should double the servings')
      assert(Math.abs(await firstQuantity() - before * 2) < 0.01 * before * 2, 'The first ingredient should double')
      await tap(page.getByRole('button', { name: 'More servings' }))
      assert(Number(await servingsInput.inputValue()) === original * 2 + 1, 'The stepper should add one serving')
      await tap(page.getByRole('group', { name: 'Scale recipe' }).getByRole('button', { name: '2×' }))
      const scaledLink = await page.getByRole('link', { name: 'Start cooking' }).getAttribute('href')
      assert(scaledLink.includes(`servings=${original * 2}`), 'Start cooking should carry the servings, got ' + scaledLink)
      const shopLink = await page.getByRole('link', { name: 'Shop ingredients' }).getAttribute('href')
      assert(shopLink.startsWith('/market?recipeId=') && shopLink.includes(`servings=${original * 2}`), 'Shop ingredients should open the market page for this recipe, got ' + shopLink)
      await tap(page.getByRole('link', { name: 'Start cooking' }))
      await page.waitForURL('**/cook?servings=*')
      await page.getByText(`Scaled from the recipe’s ${original} servings.`).first().waitFor()
      assert(Math.abs(Number((await page.getByRole('checkbox', { name: /^Prepped: / }).first().locator('xpath=ancestor::label').innerText()).match(/[\d.]+/)[0]) - before * 2) < 0.01 * before * 2, 'Prep checklist should show the scaled quantity')
      await tap(page.getByRole('group', { name: 'Servings' }).getByRole('button', { name: '1×' }))
      await page.getByText(/Scaled from the recipe/).waitFor({ state: 'detached' })
      await tap(page.getByRole('group', { name: 'Servings' }).getByRole('button', { name: '2×' }))
      await page.waitForURL('**/cook?servings=*')
      await page.getByRole('heading', { name: 'Prep & Mise en Place' }).waitFor()
      assert(await page.getByText(/Oven preheating:/).count() === 1, 'Prep should remind the cook to preheat the oven')
      const prepBoxes = page.getByRole('checkbox', { name: /^Prepped: / })
      assert(await prepBoxes.count() >= 3, 'Prep should list every ingredient with a checkbox')
      await prepBoxes.first().check()
      await page.getByText(new RegExp(`^1 of ${await prepBoxes.count()} prepped$`)).waitFor()
      await shot(page, viewport, 'kitchen-prep')
      await tap(page.getByRole('button', { name: /All Prepped/ }))
      await page.getByText(/^Step 1 of /).waitFor()
      await page.locator('.step-bar').waitFor()
      const bar = await page.locator('.step-bar').boundingBox()
      assert(bar && Math.abs(bar.y + bar.height - viewport.height) <= 1, 'Step bar should be fixed to the bottom of the viewport')
      await shot(page, viewport, 'kitchen-step-1')
    })
    await step(page, viewport, 'Flow 3 · wake lock retried on the first tap', async () => {
      // The stub refuses the request made on load; the first tap (“All Prepped — Start Cooking”) retries and is granted.
      await page.getByRole('button', { name: 'Allow screen sleep' }).waitFor()
      await page.getByRole('button', { name: 'Allow screen sleep' }).click()
      await page.getByRole('button', { name: 'Keep screen awake' }).waitFor()
      await page.locator('article').first().click()
      await page.waitForTimeout(300)
      assert(await page.getByRole('button', { name: 'Keep screen awake' }).count() === 1, 'Choosing “Allow screen sleep” should not be overridden by later taps')
      await page.getByRole('button', { name: 'Keep screen awake' }).click()
      await page.getByRole('button', { name: 'Allow screen sleep' }).waitFor()
    })
    await step(page, viewport, 'Flow 3 · swipe between steps', async () => {
      const counter = page.locator('.step-bar .num')
      const first = await counter.innerText()
      await swipe(page, page.locator('article').first(), -160)
      assert((await counter.innerText()) !== first, 'Swipe left should advance the step')
      await swipe(page, page.locator('article').first(), 160)
      assert((await counter.innerText()) === first, 'Swipe right should go back')
      await swipe(page, page.locator('article').first(), -30)
      assert((await counter.innerText()) === first, 'A short swipe should be ignored')
    })
    await step(page, viewport, 'Flow 3 · oven heat panel and timers', async () => {
      await page.getByRole('heading', { name: 'Oven adjustment' }).waitFor()
      assert((await page.locator('section.kitchen-panel', { has: page.getByRole('heading', { name: 'Oven adjustment' }) }).innerText()).includes('°C'), 'Oven panel should show a temperature')
      await shot(page, viewport, 'kitchen-oven-panel', page.getByRole('heading', { name: 'Oven adjustment' }))
      await tap(page.getByRole('button', { name: /^Start Timer/ }).first())
      const timer = page.getByRole('timer').first()
      await timer.waitFor()
      await tap(page.getByRole('button', { name: /^Pause / }).first())
      await tap(page.getByRole('button', { name: /^Resume / }).first())
      await tap(page.getByRole('button', { name: /^Remove / }).first())
      await page.getByText('Timer removed').waitFor()
      await shot(page, viewport, 'kitchen-timer-undo', page.getByText('Timer removed'))
      await tap(page.getByRole('button', { name: 'Undo' }))
      await page.getByRole('timer').first().waitFor()
      await shot(page, viewport, 'kitchen-timer-running', page.getByRole('timer').first())
    })
    await step(page, viewport, 'Flow 3 · quick presets, custom timer and the timers HUD', async () => {
      const timersPanel = page.locator('#cooking-timers')
      const before = await page.getByRole('timer').count()
      await tap(timersPanel.getByRole('button', { name: 'Start 3m timer for Soft-boiled eggs' }))
      await page.getByRole('timer', { name: '3m', exact: true }).waitFor()
      assert(await page.getByRole('timer').count() === before + 1, 'A quick preset should start one timer')
      const minutes = timersPanel.getByRole('spinbutton', { name: 'Minutes' })
      await minutes.fill('1')
      await tap(timersPanel.getByRole('button', { name: 'Add 5 minutes' }))
      assert(await minutes.inputValue() === '6', '+5m should add five minutes')
      await tap(timersPanel.getByRole('button', { name: 'Add 1 minute' }))
      assert(await minutes.inputValue() === '7', '+1m should add one minute')
      await minutes.fill('0')
      assert(await timersPanel.getByRole('button', { name: 'Add Timer' }).isDisabled(), 'Add Timer should be disabled for 0 minutes')
      await minutes.fill('2')
      await timersPanel.getByRole('textbox', { name: 'Timer name' }).fill('Rest dough')
      await tap(timersPanel.getByRole('button', { name: 'Add Timer' }))
      await page.getByRole('timer', { name: 'Rest dough', exact: true }).waitFor()
      assert(await timersPanel.getByRole('textbox', { name: 'Timer name' }).inputValue() === '', 'The name field should clear after adding')
      await shot(page, viewport, 'kitchen-timer-presets', timersPanel.getByText('Quick presets'))
      // Scroll away from the timers: the HUD appears above the step bar and never covers it.
      await page.evaluate(() => window.scrollTo(0, 0))
      const hud = page.getByRole('region', { name: 'Active cooking timers HUD' })
      await hud.waitFor()
      assert(/\d\d:\d\d/.test(await hud.innerText()) && /\+ \d+ more/.test(await hud.innerText()), 'The HUD should show the nearest countdown and how many more timers run')
      const hudBox = await hud.boundingBox(), barBox = await page.locator('.step-bar').boundingBox()
      assert(hudBox.y + hudBox.height <= barBox.y, 'The HUD should sit above the step bar')
      await shot(page, viewport, 'kitchen-timers-hud', hud)
      const resumeBefore = await page.getByRole('button', { name: /^Resume / }).count()
      await tap(hud.getByRole('button', { name: /^Pause / }))
      await page.waitForFunction(count => [...document.querySelectorAll('button')].filter(b => /^Resume /.test(b.getAttribute('aria-label') || '')).length > count, resumeBefore)
      await tap(hud.locator('.timers-hud__main'))
      await page.waitForFunction(() => document.activeElement?.id === 'cooking-timers')
      await page.waitForFunction(() => !document.querySelector('.timers-hud'))
    })
    await step(page, viewport, 'Flow 3 · Rescue My Dish drawer', async () => {
      await tap(page.getByRole('button', { name: 'Rescue My Dish' }))
      const drawer = page.getByRole('dialog', { name: 'Rescue My Dish' })
      await drawer.waitFor()
      await tap(drawer.getByRole('button', { name: 'Too salty' }))
      await drawer.getByRole('heading', { name: 'Too salty' }).waitFor()
      assert((await drawer.innerText()).includes('does not selectively extract salt'), 'Salt guide should correct the potato myth')
      await shot(page, viewport, 'rescue-drawer')
      // Missing an ingredient: offline swaps work without any AI key.
      const swaps = drawer.getByRole('region', { name: 'Missing an ingredient?' })
      await tap(swaps.getByRole('group', { name: 'Recipe ingredients to substitute' }).getByRole('button', { name: 'Lemon juice' }))
      await swaps.getByText(/Instead of Lemon juice/).waitFor()
      assert(await swaps.locator('article').count() >= 2, 'A recipe ingredient chip should show at least two swaps')
      await swaps.getByRole('textbox', { name: 'Ingredient to substitute' }).fill('White wine')
      await tap(swaps.getByRole('button', { name: 'Find swap' }))
      await swaps.getByRole('heading', { name: 'Broth with lemon or vinegar' }).waitFor()
      assert((await swaps.innerText()).includes('Instant offline culinary rules.'), 'Swaps should be labelled as offline rules without a key')
      // Unknown ingredients answer 422 by design; that path is covered by tests/substitute.test.ts, not here.
      await shot(page, viewport, 'rescue-substitutions', swaps.getByRole('heading', { name: 'Broth with lemon or vinegar' }))
      await tap(drawer.getByRole('button', { name: 'Close' }))
      await drawer.waitFor({ state: 'hidden' })
    })
    await step(page, viewport, 'Flow 3 · exit guard with a running timer', async () => {
      dialogs.length = 0
      await tap(page.getByRole('link', { name: 'Exit kitchen' }))
      await page.waitForURL(url => url.pathname === arniUrl)
      assert(dialogs.some(message => message.includes('Timers are still running')), 'Leaving with a running timer should ask for confirmation')
    })
    await step(page, viewport, 'Flow 3 · scaled print card and single-recipe market list', async () => {
      await go(arniUrl)
      const original = Number(await page.locator('#servings-input').inputValue())
      await go(`${arniUrl}/print?servings=${original * 2}&system=us`)
      await page.getByText(`Serves ${original * 2} (scaled from original ${original})`).waitFor()
      assert(await page.locator('.card-ingredients strong', { hasText: /\b(oz|lb|fl oz)\b/ }).count() >= 1, 'US print card should show US units')
      await shot(page, viewport, 'print-scaled-card', page.locator('.card-heading'))
      await go(arniUrl)
      await tap(page.getByRole('link', { name: 'Shop ingredients' }))
      await page.waitForURL('**/market?recipeId=*')
      const market = page.getByRole('region', { name: 'Market shopping list' })
      await market.getByRole('checkbox', { name: /^Bought: / }).first().waitFor()
      assert(await market.locator('h3[id^="market-"]').count() >= 1, 'The market page should group items by shop')
      assert(await page.getByLabel('Recipe').inputValue() !== '', 'The recipe should be preselected')
      await shot(page, viewport, 'market-single-recipe', market)
      await go(arniUrl)
    })
    await step(page, viewport, 'Flow 3 · offline ingredient substitutions on the recipe page', async () => {
      await go(arniUrl)
      await tap(page.getByRole('button', { name: 'Culinary substitutions for Lemon juice' }))
      const dialog = page.getByRole('dialog', { name: 'Substitutions for Lemon juice' })
      await dialog.getByText(/Offline culinary rule/).waitFor()
      assert(await dialog.locator('article').count() >= 2, 'The dialog should list offline substitutions without an AI key')
      await shot(page, viewport, 'recipe-substitutions', dialog)
      await tap(dialog.getByRole('button', { name: 'Close' }))
      await dialog.waitFor({ state: 'hidden' })
    })
    await step(page, viewport, 'Flow 3 · make a family twist', async () => {
      await go(arniUrl)
      const parentTitle = await page.getByRole('heading', { level: 1 }).innerText()
      await tap(page.locator('summary', { hasText: 'More' }))
      await tap(page.getByRole('button', { name: 'Make a twist' }))
      const form = page.getByRole('form', { name: 'Make a family twist' })
      await form.getByText('Create an independent copy of this recipe').waitFor()
      await form.getByLabel(/Name your twist/).fill('Less oregano, more lemon')
      await shot(page, viewport, 'recipe-make-twist', form)
      await tap(form.getByRole('button', { name: 'Create twist' }))
      await page.waitForURL(/\/recipes\/[0-9a-f-]{36}\?edit=true$/)
      await page.getByLabel('Recipe title').waitFor()
      assert((await page.getByLabel('Recipe title').inputValue()).includes('Less oregano, more lemon'), 'The twist should open in the editor, titled with its variation name')
      const twistPath = new URL(page.url()).pathname
      await tap(page.getByRole('button', { name: 'Cancel' }))
      await page.waitForURL(url => url.pathname === twistPath && !url.search)
      const banner = page.locator('.heritage-banner')
      assert((await banner.innerText()).includes(`A family twist on ${parentTitle}`), 'The twist should credit its parent recipe')
      await shot(page, viewport, 'recipe-twist-banner', banner)
      await tap(banner.getByRole('link', { name: parentTitle }))
      await page.waitForURL(url => url.pathname === arniUrl)
      const variations = page.getByRole('region', { name: 'Family Variations' })
      await variations.getByRole('link', { name: 'Less oregano, more lemon' }).waitFor()
      await shot(page, viewport, 'recipe-family-variations', variations)
      await tap(variations.getByRole('link', { name: 'Less oregano, more lemon' }))
      await page.waitForURL(url => url.pathname === twistPath)
      await page.locator('.heritage-banner').waitFor()
      // Tidy up so later flows see the original cookbook.
      await tap(page.locator('summary', { hasText: 'More' }))
      await tap(page.getByRole('button', { name: 'Delete recipe' }))
      await tap(page.getByRole('button', { name: 'Confirm delete' }))
      await page.waitForURL('**/recipes')
    })
    await step(page, viewport, 'Flow 3 · finish cooking and pantry prompt', async () => {
      await go(arniUrl)
      await tap(page.getByRole('link', { name: 'Start cooking' }))
      await page.waitForURL('**/cook')
      for (let guard = 0; guard < 40 && await page.locator('button.step-next', { hasText: 'Done' }).count() === 0; guard++) await tap(page.locator('button.step-next').first())
      await tap(page.getByRole('button', { name: 'Done' }))
      const finish = page.getByRole('dialog', { name: 'Finished cooking?' })
      await finish.getByText('Deduct matching ingredients from your pantry?').waitFor()
      await shot(page, viewport, 'kitchen-finish-prompt', finish)
      await finish.locator('label.star-choice').nth(3).click()
      await finish.getByLabel('Add a note (optional)').fill('Crisp edges — a little less oregano next time.')
      await tap(finish.getByRole('button', { name: 'Deduct from pantry' }))
      await finish.getByRole('status').getByText('Saved to your Cook’s Journal.').waitFor()
      await tap(finish.getByRole('button', { name: 'Back to recipe' }))
      await page.waitForURL(url => url.pathname === arniUrl)
      const journal = page.getByRole('region', { name: 'Cook’s Journal' })
      await journal.getByText('Crisp edges — a little less oregano next time.').waitFor()
      await journal.getByRole('img', { name: 'Rated 4 out of 5' }).waitFor()
      await shot(page, viewport, 'recipe-cooks-journal', journal)
    })

    // Flow 4 — Dinner Conductor → backward schedule → conflicts → market list
    await step(page, viewport, 'Flow 4 · build a three-course schedule', async () => {
      await go('/meal-plan')
      // Single-task stepper: 1 guests → 2 menu → 3 plan. No guest profiles exist yet, so step 1 is skipped.
      assert(await page.locator('[aria-current="step"]').innerText().then(text => text.includes('Guests') || text.includes('Who is at the table?')), 'Conductor should open on step 1 (guests)')
      await tap(page.getByRole('button', { name: /^Next: What are we cooking/ }))
      await page.getByRole('heading', { name: 'What are we cooking?', level: 2 }).waitFor()
      const pick = async (index, title) => {
        const select = page.getByLabel(`Recipe for course ${index}`, { exact: true })
        const value = await select.locator('option', { hasText: title }).getAttribute('value')
        await select.selectOption(value)
      }
      await pick(1, 'Santorini Fava')
      await pick(2, 'Arni me Patates')
      await pick(3, 'Revani with Citrus Syrup')
      await page.getByLabel('Guests sit down').fill('20:00')
      await page.getByLabel('Guests (optional)').fill('6')
      await page.getByLabel('Month').selectOption('1')
      await tap(page.getByRole('button', { name: 'Plan our dinner' }))
      await page.getByRole('heading', { name: 'The timeline' }).waitFor()
      const briefing = page.getByRole('region', { name: 'Dinner at 20:00' })
      assert((await briefing.innerText()).includes('Guests sit down at 20:00.'), "Step 3 should open with the Chef's Briefing")
      assert(await briefing.getByRole('list', { name: 'Key times' }).getByText(/^Serve the /).count() === 3, 'Key times should list the three serves')
      await shot(page, viewport, 'conductor-briefing', briefing)
      const serves = await page.locator('ol li p.font-serif').allInnerTexts()
      assert(serves.some(text => text.includes('20:00')) && serves.some(text => text.includes('20:25')) && serves.some(text => text.includes('21:00')),
        'Courses should be served at 20:00, 20:25 and 21:00')
      const conflicts = page.locator('details.advisory', { hasText: 'Kitchen timing & equipment advisory' })
      const clear = page.getByText(/No oven or burner clashes/)
      assert((await conflicts.count()) + (await clear.count()) === 1, 'Schedule should report either conflicts or an all-clear')
      await shot(page, viewport, 'conductor-schedule', page.getByRole('heading', { name: 'The timeline' }))
      if (await conflicts.count()) await shot(page, viewport, 'conductor-conflicts', conflicts)
      await tap(briefing.getByRole('button', { name: '+10 min' }))
      const later = page.getByRole('region', { name: 'Dinner at 20:10' })
      await later.waitFor()
      assert((await later.innerText()).includes('Guests sit down at 20:10.'), 'Adding 10 minutes should recalibrate the briefing')
      await tap(later.getByRole('button', { name: '−10 min' }))
      await page.getByRole('region', { name: 'Dinner at 20:00' }).waitFor()
      const firstStep = page.getByRole('checkbox', { name: /^Done: / }).first()
      await firstStep.check()
      await page.getByText(/^1 of \d+ steps done$/).waitFor()
    })
    await step(page, viewport, 'Flow 4 · market shopping list and routing', async () => {
      const market = page.getByRole('region', { name: 'Market shopping list' })
      await tap(market.getByRole('button', { name: 'Generate Market Shopping List' }))
      for (const destination of ['Laiki market', 'Butcher', 'Supermarket']) await market.getByRole('heading', { name: destination, exact: true }).waitFor()
      await shot(page, viewport, 'market-route', market)
      const stops = () => market.locator('h3[id^="market-"]').allInnerTexts()
      const before = await stops()
      await tap(market.getByRole('button', { name: `Move ${before[0]} down` }))
      const after = await stops()
      assert(after[0] === before[1] && after[1] === before[0], 'Move down should swap the first two shops')
      const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('heirloom-market-destination-order')))
      assert(Array.isArray(stored) && stored.length === 4, 'Custom shop order should persist in localStorage')
      await tap(market.getByRole('button', { name: `Move ${before[0]} up` }))
      assert((await stops()).join() === before.join(), 'Move up should restore the original order')
      const destination = market.getByRole('combobox', { name: /^Destination for / }).first()
      const itemName = (await destination.getAttribute('aria-label')).replace('Destination for ', '')
      await destination.selectOption('supermarket')
      const moved = market.getByRole('combobox', { name: `Destination for ${itemName}`, exact: true })
      assert(await moved.inputValue() === 'supermarket', 'Per-item routing should move the item to the supermarket')
      await market.getByRole('checkbox', { name: `Bought: ${itemName}`, exact: true }).check()
      await market.getByText(/^1 of \d+ items checked$/).waitFor()
      await tap(market.getByRole('button', { name: 'One-Stop Supermarket' }))
      assert(await market.getByRole('combobox', { name: /^Destination for / }).first().isDisabled(), 'Destinations lock in One-Stop mode')
      await market.getByText(/^1 of \d+ items checked$/).waitFor()
      await shot(page, viewport, 'market-one-stop', market)
      await tap(market.getByRole('button', { name: 'Market Route' }))
      assert(await market.getByRole('combobox', { name: `Destination for ${itemName}`, exact: true }).inputValue() === 'supermarket', 'Custom route should survive a mode switch')
      // Restock: the ticked item goes to the pantry once.
      await tap(market.getByRole('button', { name: 'Restock pantry (1)' }))
      const notice = market.getByRole('status').filter({ hasText: 'Restocked 1 item into your pantry.' })
      await notice.waitFor()
      assert(await notice.getByRole('link', { name: 'View Pantry →' }).getAttribute('href') === '/pantry', 'The restock notice should link to the pantry')
      assert(await market.getByRole('button', { name: /^Restock pantry/ }).count() === 0, 'A restocked item should not be offered for restocking again')
      await shot(page, viewport, 'market-restocked', notice)
      const stocked = await page.evaluate(async name => (await (await fetch('/api/pantry')).json()).some(row => row.name === name), itemName)
      assert(stocked, `${itemName} should now be in the pantry`)
    })

    // Flow 5 — Virtual pantry, receipt parsing, recipe matching
    await step(page, viewport, 'Flow 5 · add pantry items and parse a receipt', async () => {
      await go('/pantry')
      await page.getByLabel('Name', { exact: true }).fill('Γίγαντες')
      await page.getByLabel('Quantity', { exact: true }).fill('500')
      await page.getByLabel('Unit', { exact: true }).fill('g')
      await tap(page.getByRole('button', { name: 'Add item' }))
      await page.getByRole('heading', { name: 'Γίγαντες' }).waitFor()
      await page.locator('summary', { hasText: 'Add from a receipt' }).click()
      await page.getByLabel('Receipt text').fill('ΓΑΛΑ ΦΡΕΣΚΟ 1L 1,29\nΦΕΤΑ ΠΟΠ 0,450 KG 5,40\nΣΥΝΟΛΟ 6,69')
      await tap(page.getByRole('button', { name: 'Parse receipt' }))
      await page.getByRole('button', { name: 'Save reviewed items' }).waitFor()
      assert(await page.locator('fieldset legend', { hasText: /^Item / }).count() === 2, 'Receipt should yield two items and skip the total')
      await shot(page, viewport, 'pantry-receipt-review', page.getByRole('button', { name: 'Save reviewed items' }))
      await tap(page.getByRole('button', { name: 'Save reviewed items' }))
      await page.getByText('Receipt items saved.').waitFor()
    })
    await step(page, viewport, 'Flow 5 · pantry storage tabs', async () => {
      const group = page.getByRole('group', { name: 'Filter by storage' })
      const total = Number((await group.getByRole('button', { name: /^all \(\d+\)$/ }).innerText()).match(/\d+/)[0])
      assert(total >= 3, 'All tab should count every pantry item')
      const fridge = group.getByRole('button', { name: /^fridge \(\d+\)$/ })
      const fridgeCount = Number((await fridge.innerText()).match(/\d+/)[0])
      assert(fridgeCount >= 1 && fridgeCount < total, 'Fridge tab should count only fridge items')
      await tap(fridge)
      assert(await page.getByRole('list', { name: 'Pantry inventory' }).getByRole('listitem').count() === fridgeCount, 'Fridge tab should list only fridge items')
      assert(await fridge.getAttribute('aria-pressed') === 'true', 'Active tab should be pressed')
      await shot(page, viewport, 'pantry-storage-tabs', group)
      await tap(group.getByRole('button', { name: /^all / }))
      assert(await page.getByRole('list', { name: 'Pantry inventory' }).getByRole('listitem').count() === total, 'All tab should restore the full list')
    })
    await step(page, viewport, 'Flow 5 · quick-add staples and quantity steppers', async () => {
      const card = name => page.getByRole('list', { name: 'Pantry inventory' }).getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) })
      const quantity = async name => Number((await card(name).locator('.tabular-nums').innerText()).replace(',', '.'))
      await tap(page.getByRole('button', { name: 'Add 200 g of Feta to pantry' }))
      await page.getByRole('status').filter({ hasText: 'Restocked Feta (+200 g) in your fridge.' }).waitFor()
      await card('Feta').waitFor()
      assert(await quantity('Feta') === 200, 'Quick-add should stock 200 g of feta')
      await tap(card('Feta').getByRole('button', { name: 'Increase Feta quantity' }))
      await page.waitForFunction(() => [...document.querySelectorAll('.tabular-nums')].some(el => el.textContent.trim() === '250'))
      assert(await quantity('Feta') === 250, 'The + stepper should add 50 g for grams')
      await tap(card('Feta').getByRole('button', { name: 'Decrease Feta quantity' }))
      await page.waitForFunction(() => [...document.querySelectorAll('.tabular-nums')].some(el => el.textContent.trim() === '200'))
      const saved = await page.evaluate(async () => (await (await fetch('/api/pantry')).json()).find(row => row.name === 'Feta')?.quantity)
      assert(saved === 200, 'The stepper should persist to the server, got ' + saved)
      // Counted items step by one, and running out is shown rather than deleting the item.
      // Earlier flows may already have stocked some staples in other units, so pick one that is not in the pantry yet.
      const counted = [['Garlic', 1], ['Lemons', 4], ['Eggs', 6]]
      let pick
      for (const [name, amount] of counted) if (await card(name).count() === 0) { pick = [name, amount]; break }
      assert(pick, 'One counted staple should still be unstocked')
      const [name, amount] = pick
      await tap(page.getByRole('button', { name: `Add ${amount} item of ${name} to pantry` }))
      await card(name).waitFor()
      for (let left = amount; left > 0; left--) {
        await tap(card(name).getByRole('button', { name: `Decrease ${name} quantity` }))
        await page.waitForFunction(([label, expected]) => [...document.querySelectorAll('li')].some(li => li.querySelector('h2')?.textContent.trim() === label && li.querySelector('.tabular-nums')?.textContent.trim() === String(expected)), [name, left - 1])
      }
      await card(name).getByText('Out of stock').waitFor()
      assert(await card(name).getByRole('button', { name: `Decrease ${name} quantity` }).isDisabled(), 'Decrease should be disabled at zero')
      await shot(page, viewport, 'pantry-quickstock', page.getByRole('region', { name: 'Quick-add kitchen staples' }))
    })
    await step(page, viewport, 'Flow 5 · cook with what I have', async () => {
      await tap(page.getByRole('button', { name: 'Cook With What I Have' }))
      const matches = page.getByRole('region', { name: 'Recipe matches' })
      await matches.getByText(/% in stock/).first().waitFor()
      await shot(page, viewport, 'pantry-matches', matches)
    })
    await step(page, viewport, 'Flow 5 · what can I cook tonight', async () => {
      await tap(page.getByRole('button', { name: 'What can I cook tonight?' }))
      const chef = page.getByRole('group', { name: 'Chef advice' })
      await chef.getByText('Tonight, from your kitchen').waitFor()
      assert(await chef.locator('section, [role=status]').count() >= 1, 'Chef advice should show at least one suggestion section or a friendly empty state')
      await shot(page, viewport, 'pantry-chef-advice', chef)
    })

    // Flow 6 — Guests & allergen cross-referencing
    await step(page, viewport, 'Flow 6 · guest profile and meal audit', async () => {
      await go('/guests')
      await page.getByLabel('Name', { exact: true }).fill('Maria')
      await page.getByRole('checkbox', { name: 'dairy' }).check()
      await page.getByRole('checkbox', { name: 'eggs' }).check()
      await page.getByRole('checkbox', { name: 'vegetarian' }).check()
      await tap(page.getByRole('button', { name: 'Save guest' }))
      await page.getByRole('heading', { name: 'Maria' }).waitFor()
      const audit = page.getByRole('region', { name: 'Dietary audit' })
      await audit.getByRole('checkbox', { name: 'Maria' }).check()
      await audit.getByRole('checkbox', { name: 'Traditional Spanakopita' }).check()
      await tap(audit.getByRole('button', { name: 'Audit meal' }))
      await audit.getByText(/conflicts? to review/).waitFor()
      const text = await audit.innerText()
      assert(/critical allergen/i.test(text) && /feta/i.test(text), 'Spanakopita feta should be flagged for a dairy allergy')
      await shot(page, viewport, 'guests-audit', audit.getByText(/conflicts? to review/))
    })
    await step(page, viewport, 'Flow 6 · allergen shield on the recipe and in Kitchen Mode', async () => {
      await go('/recipes')
      await tap(page.getByRole('link', { name: 'Traditional Spanakopita' }))
      await page.getByText(/^Contains: .*dairy/).waitFor()
      await shot(page, viewport, 'recipe-allergen-tag', page.getByText(/^Contains: /))
      await tap(page.getByRole('link', { name: 'Start cooking' }))
      await page.waitForURL('**/cook')
      const alert = page.getByRole('alert').filter({ hasText: 'Allergen check before you start' })
      await alert.waitFor()
      assert(/Maria:\s*dairy in .*feta/i.test(await alert.innerText()), 'The prep screen should name the guest, allergen and ingredient')
      await shot(page, viewport, 'kitchen-allergen-alert', alert)
    })

    // Flow 7 — Settings: BYOK keys, kitchen hardware, Cook's Handbook
    await step(page, viewport, 'Flow 7 · BYOK keys stay in the browser', async () => {
      await go('/settings')
      const sent = []
      const spy = request => { if ((request.postData() || '').includes('sk-e2e-test') || Object.values(request.headers()).some(value => value.includes('sk-e2e-test'))) sent.push(request.url()) }
      page.on('request', spy)
      await page.getByLabel('openai API key').fill('sk-e2e-test')
      await tap(page.getByRole('button', { name: 'Save keys & model' }))
      await page.reload()
      await page.waitForLoadState('networkidle')
      assert(await page.getByLabel('openai API key').inputValue() === 'sk-e2e-test', 'Key should persist in this browser')
      page.off('request', spy)
      assert(sent.length === 0, 'Saving keys must not send them to any server: ' + sent.join(', '))
    })
    await step(page, viewport, 'Flow 7 · kitchen hardware profile', async () => {
      await page.getByLabel('Stove type').selectOption('induction')
      await page.getByLabel('Oven type').selectOption('static_conventional')
      await tap(page.getByRole('button', { name: 'Save kitchen profile' }))
      await page.getByText('Kitchen profile saved.').waitFor()
      await page.reload()
      await page.waitForLoadState('networkidle')
      assert(await page.getByLabel('Stove type').inputValue() === 'induction', 'Kitchen profile should persist on the server')
      await shot(page, viewport, 'settings', page.getByRole('heading', { name: 'Your kitchen hardware' }))
    })
    await step(page, viewport, 'Flow 7 · backup and restore', async () => {
      const [download] = await Promise.all([page.waitForEvent('download'), tap(page.getByRole('button', { name: /Download Backup/ }))])
      assert(/^heirloom-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), 'Backup should download as a dated .json file')
      const path = await download.path()
      const backup = JSON.parse(readFileSync(path, 'utf8'))
      assert(Array.isArray(backup.recipes) && backup.recipes.length >= 5, 'Backup should contain the cookbook recipes')
      await page.getByLabel('Restore Backup file').setInputFiles(path)
      await page.getByText(/backup has been restored/).waitFor()
      await shot(page, viewport, 'settings-backup', page.getByRole('heading', { name: 'Cookbook Backup & Portability' }))
      // Unreadable files are rejected in the browser; the server's rejection of malformed backups is covered by unit tests.
      await page.getByLabel('Restore Backup file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') })
      await page.getByRole('alert').filter({ hasText: /isn’t a readable Heirloom backup/ }).waitFor()
    })
    await step(page, viewport, "Flow 7 · Cook's Handbook", async () => {
      await tap(page.getByRole('link', { name: "Cook's Handbook" }))
      await page.waitForURL('**/handbook')
      const handbook = page.getByRole('article', { name: "Cook's Handbook" })
      await handbook.waitFor()
      assert(await handbook.locator('h2').count() >= 3, 'Handbook should render its sections')
      await shot(page, viewport, 'handbook')
    })

    verifyClean()
  } finally {
    await context.close()
    await server.stop()
  }
}

async function main() {
  mkdirSync(SHOTS, { recursive: true })
  for (const file of readdirSync(SHOTS)) if (file.endsWith('.png')) rmSync(join(SHOTS, file))
  const headed = process.env.HEADED === 'true' || process.env.HEADLESS === 'false'
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    headless: !headed,
    slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : (headed ? 100 : 0)
  })
  const started = Date.now()
  try {
    for (const viewport of VIEWPORTS) {
      console.log(`\n${viewport.name} (${viewport.width}px)`)
      try {
        await journey(browser, viewport)
      } catch (error) {
        report.failures.push(`${viewport.name}: ${error.message}`)
        console.log('FAILED\n    ' + error.message)
      }
    }
  } finally {
    await browser.close()
  }
  console.log(`\nSteps: ${report.steps} · assertions: ${report.assertions} · screenshots: ${report.screenshots.length} (docs/screenshots/e2e-flow/) · ${((Date.now() - started) / 1000).toFixed(1)}s`)
  if (report.failures.length) {
    console.log('FAILED:\n  ' + report.failures.join('\n  '))
    process.exit(1)
  }
  console.log('PASS: all user flows completed with zero console errors, page errors, or failed requests.')
}

await main()
