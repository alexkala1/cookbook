import type { Ref } from 'vue'

/** Feedback is local to the action; success clears silently after two seconds. */
export function useActionFeedback(busy: Ref<boolean>, error: Ref<string>) {
  const done = ref(false)
  let timeout: ReturnType<typeof setTimeout> | undefined
  watch(busy, (value, previous) => {
    clearTimeout(timeout)
    done.value = false
    if (previous && !value && !error.value) {
      done.value = true
      timeout = setTimeout(() => { done.value = false }, 2000)
    }
  }, { flush: 'sync' })
  onBeforeUnmount(() => clearTimeout(timeout))
  const state = computed(() => busy.value ? 'loading' : error.value ? 'error' : done.value ? 'success' : undefined)
  const label = (idle: string, pending = 'Working…') => busy.value ? pending : error.value ? 'Try again' : done.value ? 'Done' : idle
  return { state, label }
}
