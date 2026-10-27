import { describe, expect, test } from 'bun:test'
import { buildBaseStylesheet, emitBaseStylesheet } from '../baseStylesheet'

describe('the base stylesheet', () => {
  test('builds one hashed stylesheet under /assets/, naming no font file', async () => {
    const base = await buildBaseStylesheet()
    expect(base.href).toMatch(/^\/assets\/base-[\w-]+\.css$/)
    const css = String(base.files.find((file) => `/${file.fileName}` === base.href)?.source)
    // The package entry's layers; the faces are each document's (`Fonts.astro`).
    expect(css).toContain('@layer su-reset')
    expect(css).not.toContain('@font-face')
    expect(base.files.map((file) => file.fileName)).toEqual([base.href.slice(1)])
  }, 30_000)

  test('is built once per process', () => {
    expect(buildBaseStylesheet()).toBe(buildBaseStylesheet())
  })

  test("srd's plugin emits every file into its bundle at its own name", async () => {
    const emitted: string[] = []
    const plugin = emitBaseStylesheet()
    const generate = plugin.generateBundle as unknown as (this: unknown) => Promise<void>
    await generate.call({
      emitFile: ({ fileName }: { fileName: string }) => emitted.push(fileName),
    })
    const { files } = await buildBaseStylesheet()
    expect(emitted).toEqual(files.map((file) => file.fileName))
  }, 30_000)
})
