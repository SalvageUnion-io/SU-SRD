import { describe, expect, test } from 'bun:test'
import { buildBaseStylesheet, emitBaseStylesheet } from '../baseStylesheet'

describe('the base stylesheet', () => {
  test('builds one hashed stylesheet under /assets/, with the fonts it names', async () => {
    const base = await buildBaseStylesheet()
    expect(base.href).toMatch(/^\/assets\/base-[\w-]+\.css$/)
    const css = String(base.files.find((file) => `/${file.fileName}` === base.href)?.source)
    // The package entry's layers, and the faces the pages preload.
    expect(css).toContain('@layer su-reset')
    expect(css).toContain('font-family:Barlow Semi Condensed')
    for (const { fileName } of base.files) {
      expect(fileName).toMatch(/^assets\//)
      if (fileName.endsWith('.woff2')) expect(css).toContain(`/${fileName}`)
    }
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
