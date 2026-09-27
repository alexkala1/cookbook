// Run with the Playwright MCP code-file runner against an isolated server on 3113.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' })
  const view = await context.newPage()
  const errors = []
  view.on('pageerror', error => errors.push(error.message))
  view.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  view.on('requestfailed', request => errors.push(request.url()))
  const results = []
  try {
    for (const width of [375, 1280]) {
      await view.setViewportSize({ width, height: 900 })
      await view.goto('http://127.0.0.1:3113/settings')
      await view.waitForLoadState('networkidle')
      const link = view.getByRole('link', { name: "Cook's Handbook", exact: true })
      await link.focus()
      const target = await link.evaluate(element => ({
        height: element.getBoundingClientRect().height,
        focus: document.activeElement === element,
        outline: getComputedStyle(element).outlineStyle,
        fontStyle: getComputedStyle(element).fontStyle
      }))
      if (target.height < 44 || !target.focus || target.outline === 'none' || target.fontStyle !== 'normal') throw Error('Settings link accessibility failed')
      await view.screenshot({ path: `/home/alex/repos/cookbook/docs/screenshots/handbook/settings-${width}.png` })
      await link.press('Enter')
      await view.getByRole('heading', { name: "Cook's Handbook", exact: true }).waitFor()
      await view.waitForLoadState('networkidle')
      const issues = await view.locator('.handbook').evaluate(article => {
        const issues = []
        if (document.documentElement.scrollWidth > innerWidth) issues.push('Horizontal overflow')
        for (const anchor of article.querySelectorAll('a[href^="#"]')) {
          if (!document.getElementById(anchor.hash.slice(1))) issues.push(`Missing anchor: ${anchor.hash}`)
          if (anchor.getBoundingClientRect().height < 44) issues.push('Small tap target')
        }
        if ([...article.querySelectorAll('*')].some(element => getComputedStyle(element).fontStyle === 'italic')) issues.push('Italic text')
        return issues
      })
      if (issues.length) throw Error(issues.join(', '))
      await view.screenshot({ path: `/home/alex/repos/cookbook/docs/screenshots/handbook/guide-${width}.png` })
      await view.getByRole('link', { name: 'Keep a useful pantry', exact: true }).click()
      await view.waitForURL('**/handbook#keep-a-useful-pantry')
      await view.waitForFunction(() => {
        const top = document.getElementById('keep-a-useful-pantry').getBoundingClientRect().top
        return top >= 55 && top <= 200
      })
      await view.getByRole('link', { name: 'Back to top', exact: true }).click()
      await view.waitForURL('**/handbook#cook-s-handbook')
      await view.reload()
      await view.getByRole('heading', { name: "Cook's Handbook", exact: true }).waitFor()
      await view.getByRole('link', { name: 'Back to Settings', exact: true }).click()
      await view.getByRole('heading', { name: 'Your kitchen & keys', exact: true }).waitFor()
      results.push({ width, linkHeight: target.height, anchors: 'pass', reload: 'pass', keyboard: 'pass', overflow: 'none' })
    }
    if (errors.length) throw Error(errors.join('\n'))
    return { results, errors }
  } finally { await context.close() }
}
