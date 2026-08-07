import { describe, expect, test } from 'bun:test'

/**
 * The artwork fade-in must not survive into SERVER-rendered markup.
 *
 * srd renders entity cards through its zero-JS static path — the card is not an
 * island, so React never mounts over it and `CardImage`'s `onLoad` / cached-load
 * effect can never run. When the server emitted `style="opacity:0"`, nothing was
 * left to clear it: every piece of entity artwork on the site downloaded in full
 * (a ~500 KB webp for a chassis) and then painted nothing, leaving a blank column
 * beside the description on all 57 artwork-bearing entity pages.
 *
 * This is asserted in a SUBPROCESS on purpose. Every bunfig in this repo preloads
 * happy-dom, so `window` is defined in-process and the server branch is
 * unreachable from an ordinary test — the bug would stay green. A bare `bun -e`
 * child has no preload and therefore no DOM, which is exactly the environment
 * `apps/srd/ssg` renders under (Bun directly, never through Vite).
 */
describe('CardImage server rendering', () => {
  test('emits visible artwork when rendered without a DOM', () => {
    const script = `
      const { renderToStaticMarkup } = await import('react-dom/server')
      const { createElement } = await import('react')
      const { CardImage } = await import('${import.meta.dir}/../CardImage.tsx')
      if (typeof window !== 'undefined') throw new Error('expected a DOM-free process')
      process.stdout.write(
        renderToStaticMarkup(
          createElement(CardImage, {
            url: 'https://assets.salvageunion.io/chassis/mule.webp',
            alt: 'Mule illustration',
          })
        )
      )
    `
    const proc = Bun.spawnSync(['bun', '-e', script], { stdout: 'pipe', stderr: 'pipe' })
    const stderr = proc.stderr.toString()
    expect(stderr).toBe('')
    expect(proc.exitCode).toBe(0)

    const markup = proc.stdout.toString()
    // The image is present...
    expect(markup).toContain('https://assets.salvageunion.io/chassis/mule.webp')
    // ...and nothing hides it. `opacity:0` here is the defect itself, not a
    // detail of how the fade is implemented — with no client runtime it is
    // permanent.
    expect(markup).not.toContain('opacity:0')
  })
})
