/**
 * baseStylesheet — the one stylesheet both apps link: the Barlow faces and the
 * src/components entry (`./base.css`), at `/assets/base-<hash>.css`.
 *
 * srd and the app once bundled the fonts and the package stylesheet into
 * their own CSS, under their own bases: a visit crossing from one to the other
 * downloaded the same ~115 KB twice, from two URLs. It is built once here, with
 * no config either app could change, and the one Vite pass (`vite.config.ts`)
 * emits it (`emitBaseStylesheet`) and links it from the app's shell
 * (`baseStylesheetLink`, `ssg/appPlugins.ts`); srd's pages link it from
 * the manifest (`ssg/build.ts`).
 *
 * In dev there is nothing to build: both apps link `/src/styles/base.css`,
 * which the dev server serves as CSS.
 */

import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { build } from 'vite'

/** The source, and its URL on the dev server. */
const SOURCE = fileURLToPath(new URL('./base.css', import.meta.url))
export const DEV_BASE_STYLESHEET = '/src/styles/base.css'

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** One emitted file, by its path under the asset root (`assets/…`). */
type BaseFile = { fileName: string; source: string | Uint8Array }

export type BaseStylesheet = {
  /** The stylesheet's URL, `/assets/base-<hash>.css`. */
  href: string
  /** The stylesheet and every font it names. */
  files: BaseFile[]
}

type Output = { output: Array<{ type: string; fileName: string; source?: string | Uint8Array }> }

let pending: Promise<BaseStylesheet> | undefined

/** Builds the base stylesheet once per process. */
export function buildBaseStylesheet(): Promise<BaseStylesheet> {
  pending ??= run()
  return pending
}

async function run(): Promise<BaseStylesheet> {
  // No config file: nothing either app configures may change these bytes.
  const result = (await build({
    configFile: false,
    root: APP_ROOT,
    base: '/',
    publicDir: false,
    envDir: false,
    logLevel: 'warn',
    build: {
      write: false,
      emptyOutDir: false,
      rolldownOptions: { input: { base: SOURCE } },
    },
  })) as Output | Output[]
  const outputs = Array.isArray(result) ? result : [result]
  const files = outputs
    .flatMap((o) => o.output)
    .filter((file) => file.type === 'asset' && file.source !== undefined)
    .map((file) => ({ fileName: file.fileName, source: file.source as string | Uint8Array }))
  const css = files.filter((file) => file.fileName.endsWith('.css'))
  if (css.length !== 1) {
    throw new Error(`[base-stylesheet] expected one stylesheet, built ${css.length}`)
  }
  return { href: `/${css[0]?.fileName}`, files }
}

/**
 * The files go into the bundle at their own names, so srd's service worker
 * precaches them like the rest of `dist/assets/`.
 */
export function emitBaseStylesheet(): Plugin {
  return {
    name: 'base-stylesheet',
    apply: 'build',
    async generateBundle() {
      for (const { fileName, source } of (await buildBaseStylesheet()).files) {
        this.emitFile({ type: 'asset', fileName, source })
      }
    },
  }
}
