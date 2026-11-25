import { describe, expect, it } from 'bun:test'
import { serveRoot } from '../activityLaunch'
import { activityOrigin, crossOrigin } from '../shared/refusals'

/**
 * The Discord Activity at the site's root (`../activityLaunch.ts`), and the
 * frame's origin, which the cookie-signed routes take as this site's own
 * (`../shared/refusals.ts`).
 */

function assets() {
  const asked: string[] = []
  return {
    asked,
    fetch: async (request: Request) => {
      const url = new URL(request.url)
      asked.push(`${url.pathname}${url.search}`)
      return new Response('<html lang="en"><body></body></html>', {
        headers: { 'content-type': 'text/html' },
      })
    },
  }
}

describe('serveRoot', () => {
  it("answers Discord's launch with the app's shell, its Union bar hidden", async () => {
    const binding = assets()
    const res = await serveRoot(
      new Request('https://salvageunion.io/?frame_id=f&instance_id=i'),
      binding
    )
    expect(binding.asked).toEqual(['/build/'])
    expect(await res.text()).toContain('<html data-union-bar-hidden lang="en">')
  })

  it('answers any other visit with the home page', async () => {
    const binding = assets()
    await serveRoot(new Request('https://salvageunion.io/'), binding)
    await serveRoot(new Request('https://salvageunion.io/?frame_id=f'), binding)
    expect(binding.asked).toEqual(['/', '/?frame_id=f'])
  })
})

describe('crossOrigin', () => {
  // A request as the Worker reads it; the test DOM's Request drops `origin`.
  const write = (origin: string) =>
    ({
      url: 'https://salvageunion.io/__rooms/call',
      headers: { get: (name: string) => (name === 'origin' ? origin : null) },
    }) as unknown as Request

  it("takes this site's own pages and its Activity's frame as this site", () => {
    expect(crossOrigin(write('https://salvageunion.io'), 'client')).toBe(false)
    expect(crossOrigin(write(activityOrigin('client')), 'client')).toBe(false)
  })

  it("refuses another site, another app's frame, and any frame where no app is set", () => {
    expect(crossOrigin(write('https://evil.example'), 'client')).toBe(true)
    expect(crossOrigin(write(activityOrigin('other')), 'client')).toBe(true)
    expect(crossOrigin(write(activityOrigin('client')))).toBe(true)
  })
})
