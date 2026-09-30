export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: {
    compatibilityVersion: 4
  },
  devtools: { enabled: false },
  devServer: { host: process.env.NUXT_HOST || '127.0.0.1' },
  modules: ['@nuxt/ui', '@vueuse/nuxt', '@vite-pwa/nuxt'],
  fonts: {
    defaults: { subsets: ['latin', 'greek'], styles: ['normal'] },
    families: [
      { name: 'Literata', provider: 'google', weights: [600, 700] },
      { name: 'Commissioner', provider: 'google', weights: [400, 600, 700] }
    ]
  },
  colorMode: { preference: 'light', fallback: 'light' },
  // CSS-mode icons prepend their component layer ahead of head tags after hydration.
  // SVG mode preserves the locked cascade and keeps Lucide icons local and accessible.
  icon: { mode: 'svg' },
  app: { head: {
    title: 'Heirloom',
    // Icon SSR styles can precede the entry stylesheet; establish cascade order first.
    style: [{ key: 'heirloom-layer-order', innerHTML: '@layer properties, theme, base, components, utilities;', tagPriority: -100 }],
    htmlAttrs: { lang: 'en' },
    viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
    meta: [
      { name: 'theme-color', content: '#faf8f5' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Heirloom' }
    ],
    link: [{ rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' }, { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }]
  } },
  nitro: { prerender: { routes: ['/'] } },
  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Heirloom — Family Cookbook', short_name: 'Heirloom',
      description: 'Your family cookbook and kitchen companion.',
      start_url: '/recipes', scope: '/', display: 'standalone', orientation: 'portrait',
      background_color: '#faf8f5', theme_color: '#faf8f5', lang: 'en',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/',
      // Nuxt's prerendered Home payload is not an SPA shell for other routes.
      // Serve other documents from the network, or their own previously visited HTML.
      navigateFallbackAllowlist: [/^\/$/],
      navigateFallbackDenylist: [/^\/api\//, /^\/dev\//],
      globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
      runtimeCaching: [{
        urlPattern: ({ url, request, sameOrigin }) => sameOrigin && request.method === 'GET' && request.mode === 'navigate'
          && !/^\/(api|dev)\//.test(url.pathname)
          && !Array.from(request.headers.keys()).some(key => key.toLowerCase().startsWith('x-byok-')),
        handler: 'NetworkFirst', options: { cacheName: 'heirloom-pages', networkTimeoutSeconds: 3, expiration: { maxEntries: 100, maxAgeSeconds: 604800 }, cacheableResponse: { statuses: [200] } }
      }, {
        urlPattern: ({ url, request, sameOrigin }) => sameOrigin && request.method === 'GET'
          && !Array.from(request.headers.keys()).some(key => key.toLowerCase().startsWith('x-byok-'))
          && /^\/api\/(recipes|settings\/kitchen|pantry|guests)(\/|$)/.test(url.pathname),
        handler: 'NetworkFirst', options: { cacheName: 'heirloom-api', networkTimeoutSeconds: 3, expiration: { maxEntries: 200, maxAgeSeconds: 604800 }, cacheableResponse: { statuses: [200] } }
      }]
    },
    client: { installPrompt: true },
    devOptions: { enabled: false }
  },
  css: ['~/assets/css/main.css']
})
