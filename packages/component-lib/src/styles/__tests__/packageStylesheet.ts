import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** `src/styles/index.css`: the package stylesheet, imports only. */
export const PACKAGE_STYLESHEET = join(import.meta.dir, '../index.css')

const RELATIVE_IMPORT = /^@import\s+'(\.[^']+)';$/gm

/**
 * The package stylesheet as the bundler serves it: `index.css` with each
 * relative `@import` replaced by the file it names, recursively, in order.
 * A test that reads a rule reads it here, so moving a rule between the parts
 * never breaks it. Relative `url()`s are left as each part spells them.
 */
export function readPackageStylesheet(path: string = PACKAGE_STYLESHEET): string {
  return readFileSync(path, 'utf8').replace(RELATIVE_IMPORT, (_, rel: string) =>
    readPackageStylesheet(join(dirname(path), rel))
  )
}
