import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// Serves the dev-only story catalog (`bun run stories`): `index.html` mounts
// `src/catalog.tsx`. Nothing builds it; `public/` holds the files the apps'
// stories link at the site root (ITUN's logo mark, srd's Powered-by badge).
export default defineConfig({
  plugins: [react()],
  resolve: {
    // ITUN's Convex client is built from `VITE_CONVEX_URL` when its module
    // evaluates. The catalog has no deployment, so it gets a stub instead.
    alias: [
      {
        find: /^(?:\.\.\/)+lib\/connection\/convexClient$/,
        replacement: fileURLToPath(new URL('./src/convexClientStub.ts', import.meta.url)),
      },
    ],
  },
  server: { port: 61000, strictPort: true },
})
