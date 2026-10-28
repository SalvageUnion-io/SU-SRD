import { describe, expect, test } from 'bun:test'

/**
 * The front door renders the same with only `FRONT_DOOR_SCHEMAS` loaded as
 * with the whole dataset, and reads nothing it does not hold for (a reader
 * that falls back on a missing schema degrades silently, `readReference`).
 *
 * In a SUBPROCESS on purpose: every bunfig here preloads the whole dataset
 * (`tools/testPreload.ts`) and a loaded schema is never unloaded, so in-process
 * the subset could not be told from everything. A bare `bun -e` child has no
 * preload, the way the app's first paint has only what it asked for.
 */
function renderFrontDoor(schemas: 'subset' | 'all'): { markup: string; stderr: string } {
  const script = `
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { createElement } = await import('react')
    const { SalvageUnionReference } = await import('salvageunion-reference')
    const { FRONT_DOOR_SCHEMAS } = await import('${import.meta.dir}/../frontDoor.model.ts')
    await SalvageUnionReference.preload(${schemas === 'all' ? "'all'" : 'FRONT_DOOR_SCHEMAS'})
    const { FrontDoor } = await import('${import.meta.dir}/../FrontDoor.tsx')
    process.stdout.write(renderToStaticMarkup(createElement(FrontDoor)))
  `
  const proc = Bun.spawnSync(['bun', '-e', script], {
    cwd: import.meta.dir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  expect(proc.exitCode).toBe(0)
  return { markup: proc.stdout.toString(), stderr: proc.stderr.toString() }
}

describe('FRONT_DOOR_SCHEMAS', () => {
  test('are all the front door reads', () => {
    const subset = renderFrontDoor('subset')
    const all = renderFrontDoor('all')
    expect(subset.stderr).toBe('')
    expect(all.markup).toContain('data-peek="classes:')
    expect(subset.markup).toBe(all.markup)
  })
})
