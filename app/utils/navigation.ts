export const appTabs = [
  { to: '/recipes', label: 'Recipes', icon: 'i-lucide-book-open' },
  { to: '/pantry', label: 'Pantry', icon: 'i-lucide-package' },
  { to: '/meal-plan', label: 'Dinner', icon: 'i-lucide-utensils' },
  { to: '/guests', label: 'Guests', icon: 'i-lucide-users' },
  { to: '/settings', label: 'Settings', icon: 'i-lucide-settings-2' }
]
export const isTabActive = (path: string, to: string) => path === to || path.startsWith(to + '/')
