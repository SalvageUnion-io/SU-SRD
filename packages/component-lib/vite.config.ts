import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// This config is consumed ONLY by Ladle (see .ladle/config.mjs `viteConfig`).
// Ladle already registers its own `@vitejs/plugin-react`, so we must NOT add a
// second one here — doing so loads the newer workspace plugin-react alongside
// Ladle's, whose react-refresh path routes through rolldown's
// `builtin:vite-react-refresh-wrapper` and crashes every transform with
// "Missing field `moduleType`" (blank stories, 404'd assets). Tailwind is the
// only plugin Ladle doesn't provide, so it's the only one we add.
export default defineConfig({
  plugins: [tailwindcss()],
})
