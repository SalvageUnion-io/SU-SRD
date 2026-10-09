import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// Serves the dev-only story catalog (`bun run stories`): `index.html` mounts
// `catalog.tsx`. Nothing builds it; the apps compile this
// package's source with their own Vite configs.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 61000, strictPort: true },
})
