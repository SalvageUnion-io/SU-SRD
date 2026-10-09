import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// Serves the dev-only story catalog (`bun run stories`): `index.html` mounts
// `catalog.tsx`. Nothing builds it; the apps compile this
// package's source with their own Vite configs.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // ITUN's Convex client is built from `VITE_CONVEX_URL` when its module
    // evaluates. The catalog has no deployment, so it gets a stub instead.
    alias: [
      {
        find: /^(?:\.\.\/)+lib\/connection\/convexClient$/,
        replacement: fileURLToPath(new URL('./catalogConvexClient.ts', import.meta.url)),
      },
    ],
  },
  server: { port: 61000, strictPort: true },
})
