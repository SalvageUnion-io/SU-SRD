import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react-swc'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
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
  // This checkout's port (61000 in the primary checkout, offset in a worktree:
  // `packages/gates/lib/ports.ts`), and the header that names the checkout so
  // `bun run shot` can refuse another checkout's server. An explicit `PORT`
  // wins, as in srd's `ssg/dev.ts`: the browser preview (`.claude/launch.json`)
  // passes the port it waits on that way.
  server: {
    port: Number(process.env.PORT ?? portFor('stories')),
    strictPort: true,
    headers: { [CHECKOUT_HEADER]: CHECKOUT_ROOT },
  },
})
