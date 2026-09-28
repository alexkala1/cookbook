// End-to-end user-flow journey for Heirloom (docs/USER_FLOWS.md).
//
//   pnpm run build && node scripts/e2e-user-flows.js
//
// By default each viewport gets its own production server (`.output/`) on a fresh temporary
// SQLite database, so Flow 1 always starts from an empty cookbook. Set E2E_BASE_URL to drive an
// already running app instead (starter recipes are then seeded through the idempotent API).
// Chromium: CHROMIUM_PATH, else Playwright's own browser, else the newest cached ms-playwright build.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
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
    env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), DATABASE_URL: database },
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
    else assert(layout.topNav === 5 && layout.tabs === 0, `${where}: desktop should show 5 top-nav links and no tab bar`)
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

    // Flow 2 — Import (offline memory draft) → save → metric conversion assistant
    await step(page, viewport, 'Flow 2 · import a recipe from memory', async () => {
      await tap(page.getByRole('link', { name: 'Import Recipe' }).first())
      await page.waitForURL('**/recipes/import')
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
      await tap(page.getByRole('link', { name: 'Start cooking' }))
      await page.waitForURL('**/cook')
      await page.locator('.step-bar').waitFor()
      const bar = await page.locator('.step-bar').boundingBox()
      assert(bar && Math.abs(bar.y + bar.height - viewport.height) <= 1, 'Step bar should be fixed to the bottom of the viewport')
      await shot(page, viewport, 'kitchen-step-1')
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
    await step(page, viewport, 'Flow 3 · Rescue My Dish drawer', async () => {
      await tap(page.getByRole('button', { name: 'Rescue My Dish' }))
      const drawer = page.getByRole('dialog', { name: 'Rescue My Dish' })
      await drawer.waitFor()
      await tap(drawer.getByRole('button', { name: 'Too salty' }))
      await drawer.getByRole('heading', { name: 'Too salty' }).waitFor()
      assert((await drawer.innerText()).includes('does not selectively extract salt'), 'Salt guide should correct the potato myth')
      await shot(page, viewport, 'rescue-drawer')
      await tap(drawer.getByRole('button', { name: 'Close' }))
      await drawer.waitFor({ state: 'hidden' })
    })
    await step(page, viewport, 'Flow 3 · exit guard with a running timer', async () => {
      dialogs.length = 0
      await tap(page.getByRole('link', { name: 'Exit kitchen' }))
      await page.waitForURL(url => url.pathname === arniUrl)
      assert(dialogs.some(message => message.includes('Timers are still running')), 'Leaving with a running timer should ask for confirmation')
    })

    // Flow 4 — Dinner Conductor → backward schedule → conflicts → market list
    await step(page, viewport, 'Flow 4 · build a three-course schedule', async () => {
      await go('/meal-plan')
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
      await tap(page.getByRole('button', { name: 'Build the schedule' }))
      await page.getByRole('heading', { name: 'The timeline' }).waitFor()
      const serves = await page.locator('ol li p.font-serif').allInnerTexts()
      assert(serves.some(text => text.includes('20:00')) && serves.some(text => text.includes('20:25')) && serves.some(text => text.includes('21:00')),
        'Courses should be served at 20:00, 20:25 and 21:00')
      const conflicts = page.getByRole('region', { name: 'Equipment conflicts' })
      const clear = page.getByText(/No oven or burner clashes/)
      assert((await conflicts.count()) + (await clear.count()) === 1, 'Schedule should report either conflicts or an all-clear')
      await shot(page, viewport, 'conductor-schedule', page.getByRole('heading', { name: 'The timeline' }))
      if (await conflicts.count()) await shot(page, viewport, 'conductor-conflicts', conflicts)
      const firstStep = page.getByRole('checkbox', { name: /^Done: / }).first()
      await firstStep.check()
      await page.getByText(/^1 of \d+ steps done$/).waitFor()
    })
    await step(page, viewport, 'Flow 4 · market shopping list and routing', async () => {
      const market = page.getByRole('region', { name: 'Market shopping list' })
      await tap(market.getByRole('button', { name: 'Generate Market Shopping List' }))
      for (const destination of ['Laiki market', 'Butcher', 'Supermarket']) await market.getByRole('heading', { name: destination, exact: true }).waitFor()
      await shot(page, viewport, 'market-route', market)
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
    await step(page, viewport, 'Flow 5 · cook with what I have', async () => {
      await tap(page.getByRole('button', { name: 'Cook With What I Have' }))
      const matches = page.getByRole('region', { name: 'Recipe matches' })
      await matches.getByText(/% in stock/).first().waitFor()
      await shot(page, viewport, 'pantry-matches', matches)
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
