/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Les variables VITE_* sont copiées dans le code livré aux navigateurs.
// On refuse de démarrer si l'une d'elles contient une clé secrète Supabase.
function forbidSecretKeys(): Plugin {
  return {
    name: 'forbid-secret-keys',
    config(_, { mode }) {
      for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), 'VITE_'))) {
        const payload = value.split('.')[1]
        let role: unknown
        try { role = payload && JSON.parse(Buffer.from(payload, 'base64url').toString()).role } catch { /* pas un JWT */ }
        if (role === 'service_role' || /service_role|secret/i.test(name) || value.startsWith('sb_secret_')) {
          throw new Error(`${name} contient une clé secrète Supabase : elle serait visible par tous. Retirez-la du .env.`)
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    forbidSecretKeys(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Gestion de stock',
        short_name: 'Stock',
        description: 'Caisse, stock et achats pour quincaillerie',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Les appels Supabase ne sont jamais mis en cache par le service worker :
        // le hors-ligne des données passe par Dexie (voir CLAUDE.md §6).
        navigateFallbackDenylist: [/^\/auth\//, /^\/rest\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
