async (page) => {
  const base = 'http://127.0.0.1:3110'
  const errors = [], failed = [], measurements = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) failed.push(request.url()) })
  const list = await (await page.request.get(base + '/api/recipes')).json()
  let recipe = list.find(row => row.title === 'Γιουβέτσι με μοσχάρι')
  if (!recipe) {
    const response = await page.request.post(base + '/api/recipes', { headers: { Origin: base }, data: {
      title: 'Γιουβέτσι με μοσχάρι', description: 'A family recipe for responsive verification.', servings: 4,
      ingredients: [{ name: 'Beef', amount: 500, unit: 'g' }],
      steps: [{ stepNumber: 1, instruction: 'Simmer the beef for 2 seconds.', durationMinutes: 1, sensoryVisual: 'A gentle simmer' }, { stepNumber: 2, instruction: 'Rest for 15 minutes before serving.', durationMinutes: 15 }]
    } })
    if (!response.ok()) throw new Error('Fixture creation failed')
    recipe = await response.json()
  }
  page.removeAllListeners('dialog')
  page.on('dialog', dialog => dialog.accept())
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/recipes', '/recipes/' + recipe.id, '/recipes/' + recipe.id + '/cook', '/pantry', '/meal-plan', '/guests', '/settings']) {
      await page.goto(base + path)
      await page.waitForLoadState('networkidle')
      if (page.url() !== base + path) throw new Error('Unexpected redirect: ' + path + ' → ' + page.url())
      await page.evaluate(() => document.fonts.ready)
      const result = await page.evaluate(() => {
        const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.sr-only')
        const short = [...document.querySelectorAll('a,button,summary,input,select,textarea')].filter(visible).filter(el => el.getBoundingClientRect().height < 43.9).map(el => ({ tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || el.type).trim().slice(0, 70), height: Math.round(el.getBoundingClientRect().height) }))
        const wrapped = [...document.querySelectorAll('a,button,summary')].filter(visible).flatMap(el => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          const tops = []
          while (walker.nextNode()) {
            const node = walker.currentNode
            if (!node.textContent.trim() || node.parentElement.closest('.sr-only,[aria-hidden="true"]')) continue
            const range = document.createRange(); range.selectNodeContents(node)
            for (const rect of range.getClientRects()) if (rect.width > 0 && !tops.some(top => Math.abs(top - rect.top) < 4)) tops.push(rect.top)
          }
          return tops.length > 1 ? [{ text: el.textContent.trim().slice(0, 80), lines: tops.length }] : []
        })
        const bar = document.querySelector('.tab-bar'), step = document.querySelector('.step-bar')
        const unstyled = [...document.querySelectorAll('.button-primary,.button-secondary,.filter-pill,.kitchen-button')].filter(visible).filter(el => {
          const css = getComputedStyle(el)
          return parseFloat(css.borderTopWidth) < 1 || ((el.classList.contains('kitchen-button') || el.classList.contains('button-primary')) && css.backgroundColor === 'rgba(0, 0, 0, 0)')
        }).map(el => el.textContent.trim())
        return { overflow: document.documentElement.scrollWidth > innerWidth, short, wrapped, unstyled,
          header: document.querySelector('header')?.getBoundingClientRect().height,
          tabs: bar && visible(bar) ? bar.querySelectorAll('a').length : 0,
          current: bar && visible(bar) ? bar.querySelectorAll('[aria-current="page"]').length : 0,
          stepFixed: step ? getComputedStyle(step).position === 'fixed' && step.getBoundingClientRect().bottom <= innerHeight : null,
          viewport: document.querySelector('meta[name="viewport"]')?.content }
      })
      measurements.push({ width, path, ...result })
    }
  }
  const failures = measurements.filter(row => row.overflow || row.short.length || row.wrapped.length || row.unstyled.length || row.header > 64
    || (row.path.endsWith('/cook') ? row.tabs !== 0 || row.stepFixed !== true : row.width < 768 ? row.tabs !== 5 || row.current !== (row.path === '/' ? 0 : 1) : row.tabs !== 0))
  if (errors.length || failed.length || failures.length) throw new Error(JSON.stringify({ errors, failed, failures }))
  return { recipeId: recipe.id, errors, failed, checks: measurements.length, failures }
}
