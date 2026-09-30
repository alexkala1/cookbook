// Playwright MCP code-file runner; use an isolated database on production port 3114.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] })
  const view = await context.newPage()
  const errors = []
  view.on('pageerror', error => errors.push(error.message))
  view.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  view.on('requestfailed', request => errors.push(request.url()))
  let recipeId
  const results = []
  try {
    await view.goto('http://127.0.0.1:3114/meal-plan')
    recipeId = await view.evaluate(async () => {
      const response = await fetch('/api/recipes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Market verification dinner', description: 'Disposable browser fixture', servings: 4,
          ingredients: [
            { name: 'Lamb shoulder', amount: 800, unit: 'g' },
            { name: 'Onion', amount: 300, unit: 'g' },
            { name: 'Bread', amount: 200, unit: 'g' },
            { name: 'Feta', amount: 300, unit: 'g' },
            { name: 'White beans', amount: 200, unit: 'g', notes: 'Soak overnight for 12 hours.' }
          ], steps: [{ stepNumber: 1, instruction: 'Simmer for 20 minutes.', durationMinutes: 20, heatLevel: 'low' }]
        })
      })
      if (!response.ok) throw Error('Fixture creation failed')
      return (await response.json()).id
    })
    for (const width of [375, 1280]) {
      await view.setViewportSize({ width, height: 900 })
      await view.goto('http://127.0.0.1:3114/meal-plan')
      await view.waitForLoadState('networkidle')
      if (await view.getByRole('button', { name: 'Generate Market Shopping List' }).count()) throw Error('Shopping action shown before schedule')
      await view.getByLabel('Recipe for course 2', { exact: true }).selectOption(recipeId)
      await view.getByLabel('Guests (optional)', { exact: true }).fill('6')
      await view.getByRole('button', { name: 'Plan our dinner', exact: true }).click()
      const market = view.getByRole('region', { name: 'Market shopping list', exact: true })
      await market.waitFor()
      const requestPromise = view.waitForRequest(request => request.url().endsWith('/api/grocery/generate') && request.method() === 'POST')
      const responsePromise = view.waitForResponse(response => response.url().endsWith('/api/grocery/generate') && response.status() === 201)
      await market.getByRole('button', { name: 'Generate Market Shopping List', exact: true }).click()
      const request = await requestPromise
      const payload = request.postDataJSON()
      if (JSON.stringify(payload) !== JSON.stringify({ courses: [{ recipeId, course: 'main' }], servings: 6 })) throw Error('Incorrect grocery request contract')
      const data = await (await responsePromise).json()
      await market.getByRole('heading', { name: 'Butcher', exact: true }).waitFor()
      for (const destination of ['Laiki market', 'Butcher', 'Bakery', 'Supermarket']) await market.getByRole('heading', { name: destination, exact: true }).waitFor()
      const lamb = data.destinations.flatMap(section => section.items).find(item => item.name === 'Lamb shoulder')
      if (!lamb || !((lamb.amount === 1200 && lamb.unit === 'g') || (lamb.amount === 1.2 && lamb.unit === 'kg'))) throw Error('Guest scaling failed')
      await market.getByText(lamb.counterPhrase, { exact: true }).waitFor()
      await market.getByText(/^Prepare ahead \(\d+\)$/).waitFor()
      if (!(await market.innerText()).includes('Surplus:')) throw Error('Surplus guidance missing')
      const checkbox = market.getByRole('checkbox', { name: 'Bought: Lamb shoulder', exact: true })
      await checkbox.check()
      if (!await checkbox.isChecked()) throw Error('Checkoff failed')
      await market.getByText('1 of 5 items checked', { exact: true }).waitFor()
      await market.getByRole('button', { name: 'Copy shopping list', exact: true }).click()
      await market.getByText('Shopping list copied.', { exact: true }).waitFor()
      const copied = await view.evaluate(() => navigator.clipboard.readText())
      if (!copied.includes('[x]') || !copied.includes(lamb.counterPhrase) || !copied.includes('Prepare ahead') || !copied.includes('Surplus:')) throw Error('Clipboard content incomplete')
      await market.getByRole('button', { name: 'Copy shopping list', exact: true }).waitFor()
      await checkbox.uncheck()
      await market.getByText('0 of 5 items checked', { exact: true }).waitFor()
      await view.emulateMedia({ reducedMotion: 'reduce' })
      await market.evaluate(element => { element.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -80) })
      await view.screenshot({ path: `/home/alex/repos/cookbook/docs/screenshots/market/list-${width}.png` })
      await market.getByRole('heading', { name: 'Butcher', exact: true }).evaluate(element => {
        element.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -80)
      })
      await view.screenshot({ path: `/home/alex/repos/cookbook/docs/screenshots/market/counter-${width}.png` })
      const issues = await market.evaluate(element => {
        const issues = []
        if (document.documentElement.scrollWidth > innerWidth) issues.push('Overflow')
        for (const target of element.querySelectorAll('button,input[type="checkbox"]')) if (target.getBoundingClientRect().height < 44) issues.push('Small target')
        if ([...element.querySelectorAll('*')].some(target => getComputedStyle(target).fontStyle === 'italic')) issues.push('Italic text')
        return issues
      })
      if (issues.length) throw Error(issues.join(', '))
      await view.getByLabel('Guests (optional)', { exact: true }).fill('8')
      await market.waitFor({ state: 'detached' })
      await view.getByRole('button', { name: 'Plan our dinner', exact: true }).click()
      await market.waitFor()
      if (await market.getByRole('checkbox').count()) throw Error('Old shopping list survived input change')
      results.push({ width, scaledServings: 6, destinations: 4, checkAndUncheck: true, clipboard: true, invalidation: true })
    }
    if (errors.length) throw Error(errors.join('\n'))
    return { results, errors }
  } finally {
    if (recipeId) await view.evaluate(async id => {
      const response = await fetch('/api/recipes/' + id, { method: 'DELETE' })
      await response.text()
    }, recipeId)
    await context.close()
  }
}
