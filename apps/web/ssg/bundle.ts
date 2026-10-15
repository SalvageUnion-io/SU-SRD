/**
 * bundle — the one Vite pass (`vite.config.ts`): srd's client entries and the
 * Cantina, into `dist/`. Step 1 of `ssg/build.ts`, which runs it as a child
 * process.
 *
 * Its own process because React cannot be loaded twice in one. The config
 * renders the Cantina's shell with `react-dom/server` under the
 * `NODE_ENV=production` Vite sets, while the SSG's render pass after it needs
 * React's development JSX runtime, which Bun chose at startup; the two builds
 * of React do not mix ("dispatcher.getOwner is not a function").
 *
 * The runner loader: the config renders the shell from the UI library's
 * TypeScript source, which only Vite's module runner resolves.
 */

import { fileURLToPath } from 'node:url'
import { build } from 'vite'

await build({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  configLoader: 'runner',
  logLevel: 'warn',
})
