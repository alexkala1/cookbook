export default defineNuxtPlugin(app => {
  app.vueApp.directive('stable-action', {
    getSSRProps: () => ({ 'data-action': '' }),
    mounted(el: HTMLElement) { el.setAttribute('data-action', '') },
    beforeUpdate(el: HTMLElement, binding) {
      if (binding.value === 'loading' && binding.oldValue !== 'loading') {
        // Retain the idle label's width through loading/success, but allow narrow viewports.
        el.style.minWidth = `min(100%, ${el.getBoundingClientRect().width}px)`
      }
    }
  })
})
