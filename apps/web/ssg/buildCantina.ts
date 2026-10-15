/**
 * buildCantina — the Cantina's client build (`vite.cantina.config.ts`) into
 * `dist/build/`, step 5 of `ssg/build.ts`, which runs it as a child process.
 *
 * Its own process because React cannot be loaded twice in one: srd's render
 * pass has already loaded React's development JSX runtime (Bun chose it at
 * startup), while this build's config renders the shell with `react-dom/server`
 * under the `NODE_ENV=production` Vite sets, and the two builds of React do
 * not mix ("dispatcher.getOwner is not a function").
 *
 * The runner loader: the config renders the shell from the UI library's
 * TypeScript source, which only Vite's module runner resolves.
 */

import { fileURLToPath } from 'node:url'
import { build } from 'vite'

await build({
  configFile: fileURLToPath(new URL('../vite.cantina.config.ts', import.meta.url)),
  configLoader: 'runner',
  logLevel: 'warn',
})
