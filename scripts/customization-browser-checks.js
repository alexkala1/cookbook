// Playwright MCP runner; isolated production instance on port 3115.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] })
  const view = await context.newPage()
  const errors = []
  view.on('pageerror', error => errors.push(error.message))
  view.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  view.on('requestfailed', request => errors.push(request.url()))
  const ids = [], results = []
  try {
    for (const width of [375, 1280]) {
      await view.setViewportSize({ width, height: 900 })
      await view.goto('http://127.0.0.1:3115/recipes')
      const recipe = await view.evaluate(async () => {
        const response = await fetch('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          title: 'Conversion and market QA', description: 'Disposable fixture', servings: 4, sourceType: 'url', sourceUrl: 'https://example.com/family-recipe',
          ingredients: [
            { name: 'all-purpose flour', amount: 1, unit: 'cup', notes: 'Family cup; sift first.' },
            { name: 'olive oil', amount: 1, unit: 'tbsp' }, { name: 'butter', amount: 1, unit: 'stick' },
            { name: 'chicken', amount: 1, unit: 'lb' }, { name: 'Mystery sauce', amount: 1, unit: 'cup' },
            { name: 'Feta', amount: 200, unit: 'g' }, { name: 'Tomato', amount: 2, unit: 'piece' }
          ], steps: [{ stepNumber: 1, instruction: 'Prepare ingredients for 10 minutes.', durationMinutes: 10 }]
        }) })
        if (!response.ok) throw Error('Fixture failed')
        return response.json()
      })
      ids.push(recipe.id)
      await view.goto('http://127.0.0.1:3115/recipes/' + recipe.id)
      const card = view.getByRole('region', { name: 'Suggest Metric Conversions (g/ml)', exact: true })
      await card.waitFor()
      await card.getByRole('button', { name: 'Dismiss', exact: true }).click()
      await card.waitFor({ state: 'detached' })
      await view.reload(); await card.waitFor()
      await view.getByLabel('Servings', { exact: true }).fill('8')
      if (!(await card.innerText()).includes('~120 g')) throw Error('Suggestion incorrectly used scaled servings')
      await view.emulateMedia({ reducedMotion: 'reduce' })
      await card.evaluate(el => { el.scrollIntoView({ behavior: 'instant', block: 'start' }); window.scrollBy(0, -80) })
      await view.screenshot({ path: `/home/alex/repos/cookbook/docs/screenshots/customization/metric-${width}.png` })
      await card.getByRole('button', { name: 'Apply to recipe', exact: true }).click()
      await card.waitFor({ state: 'detached' })
      const saved = await view.evaluate(async id => (await fetch('/api/recipes/' + id)).json(), recipe.id)
      const flour = saved.ingredients.find(item => item.name === 'all-purpose flour')
      const oil = saved.ingredients.find(item => item.name === 'olive oil')
      if (flour.amount !== 120 || flour.unit !== 'g' || flour.gramsEquivalent !== 120 || flour.notes !== 'Family cup; sift first.\nOriginal measure: 1 cup') throw Error('Metric persistence or provenance failed')
      if (oil.amount !== 15 || oil.unit !== 'ml' || oil.gramsEquivalent !== 13.44) throw Error('Oil conversion failed')
      if (saved.servings !== 4 || saved.sourceUrl !== recipe.sourceUrl || saved.ingredients.find(item => item.name === 'Mystery sauce').unit !== 'cup') throw Error('Unrelated recipe data changed')
      await view.reload()
      await view.getByRole('heading', { name: recipe.title, exact: true }).waitFor()
      if (await card.count()) throw Error('Converted measures proposed twice')
      await view.getByText('More', { exact: true }).click()
      await view.getByRole('button', { name: 'Edit recipe', exact: true }).click()
      const grams = view.getByLabel('Gram equivalent (optional)', { exact: true }).first()
      await grams.waitFor(); if (await grams.inputValue() !== '120') throw Error('Gram field unavailable')
      await grams.fill('125')
      const notes = view.getByLabel('Ingredient notes (including original measures)', { exact: true }).first()
      await notes.fill(flour.notes + '\nChecked with my scale.')
      await view.getByRole('button', { name: 'Save recipe', exact: true }).click()
      await view.getByRole('heading', { name: recipe.title, exact: true }).waitFor()
      const edited = await view.evaluate(async id => (await fetch('/api/recipes/' + id)).json(), recipe.id)
      if (edited.ingredients[0].gramsEquivalent !== 125 || !edited.ingredients[0].notes.includes('Original measure: 1 cup')) throw Error('Editing gram equivalent failed')

      await view.goto('http://127.0.0.1:3115/meal-plan')
      await view.getByLabel('Recipe for course 2', { exact: true }).selectOption(recipe.id)
      await view.getByRole('button', { name: 'Build the schedule', exact: true }).click()
      const market = view.getByRole('region', { name: 'Market shopping list', exact: true })
      await market.getByRole('button', { name: 'Generate Market Shopping List', exact: true }).click()
      const select = market.getByLabel('Destination for Feta', { exact: true })
      await select.waitFor(); await select.selectOption('laiki')
      await market.getByRole('region', { name: 'Laiki market', exact: true }).getByRole('checkbox', { name: 'Bought: Feta', exact: true }).waitFor()
      if (!await select.evaluate(el => el === document.activeElement)) throw Error('Destination change lost keyboard focus')
      await market.getByRole('checkbox', { name: 'Bought: Feta', exact: true }).check()
      await market.getByRole('button', { name: 'One-Stop Supermarket', exact: true }).click()
      if (await market.getByRole('heading', { name: 'Laiki market', exact: true }).count()) throw Error('One-stop did not consolidate')
      if (!await select.isDisabled()) throw Error('One-stop selector state incorrect')
      await market.getByRole('heading', { name: 'Produce', exact: true }).waitFor()
      await market.getByRole('button', { name: 'Copy shopping list', exact: true }).click()
      await market.getByText('Shopping list copied.', { exact: true }).waitFor()
      const text = await view.evaluate(() => navigator.clipboard.readText())
      if (!text.includes('[x] 200 g Feta') || !text.includes('Produce') || text.includes('Laiki market ·')) throw Error('One-stop export incorrect')
      await market.evaluate(el => { el.scrollIntoView({ behavior: 'instant', block: 'start' }); window.scrollBy(0, -80) })
      await view.screenshot({ path: `/home/alex/repos/cookbook/docs/screenshots/customization/supermarket-${width}.png` })
      await market.getByRole('button', { name: 'Market Route', exact: true }).click()
      if (await select.inputValue() !== 'laiki') throw Error('Custom route lost')
      if (!await market.getByRole('checkbox', { name: 'Bought: Feta', exact: true }).isChecked()) throw Error('Checkmark lost')
      await market.getByRole('button', { name: 'Copy shopping list', exact: true }).waitFor()
      await market.getByRole('button', { name: 'Copy shopping list', exact: true }).click()
      await market.getByText('Shopping list copied.', { exact: true }).waitFor()
      const split = await view.evaluate(() => navigator.clipboard.readText())
      const laiki = split.split('Laiki market ·')[1]?.split('Butcher ·')[0]
      if (!laiki?.includes('[x] 200 g Feta')) throw Error('Custom destination export incorrect')
      const problems = await market.evaluate(el => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        small: [...el.querySelectorAll('button,select,input')].some(target => target.getBoundingClientRect().height < 44),
        italic: [...el.querySelectorAll('*')].some(target => getComputedStyle(target).fontStyle === 'italic') }))
      if (Object.values(problems).some(Boolean)) throw Error(JSON.stringify(problems))
      results.push({ width, metricSaveAndReload: true, provenance: true, editableGrams: true, destinations: true, modeRestore: true, clipboard: true })
    }
    if (errors.length) throw Error(errors.join('\n'))
    return { results, errors }
  } finally {
    await view.evaluate(async ids => { for (const id of ids) { const response = await fetch('/api/recipes/' + id, { method: 'DELETE' }); await response.text() } }, ids)
    await context.close()
  }
}
