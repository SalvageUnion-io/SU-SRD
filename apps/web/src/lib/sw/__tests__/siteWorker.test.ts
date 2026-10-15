import { describe, expect, mock, test } from 'bun:test'
import { SITE_WORKER } from '../../../pwa'
import { registerSiteWorker } from '../siteWorker'

/** A page in `readyState`, with a worker container when `register` is given. */
function page(readyState: DocumentReadyState, register?: () => Promise<ServiceWorkerRegistration>) {
  const onLoad: (() => void)[] = []
  return {
    onLoad,
    host: {
      navigator: register ? { serviceWorker: { register } } : {},
      document: { readyState },
      addEventListener: (_type: 'load', listener: () => void) => {
        onLoad.push(listener)
      },
    },
  }
}

const registration = {} as ServiceWorkerRegistration

describe('registerSiteWorker', () => {
  test('registers the one worker over the whole site once the page has loaded', () => {
    const register = mock(() => Promise.resolve(registration))
    const loading = page('interactive', register)
    registerSiteWorker(loading.host)
    expect(register).not.toHaveBeenCalled()
    for (const listener of loading.onLoad) listener()
    expect(register).toHaveBeenCalledWith(SITE_WORKER.url, { scope: SITE_WORKER.scope })
    expect(SITE_WORKER).toEqual({ url: '/sw.js', scope: '/' })
  })

  test('registers at once on a page that has already loaded', () => {
    const register = mock(() => Promise.resolve(registration))
    registerSiteWorker(page('complete', register).host)
    expect(register).toHaveBeenCalledTimes(1)
  })

  test('swallows a refused registration', async () => {
    const refused = Promise.reject(new Error('Rejected'))
    refused.catch(() => undefined)
    const register = mock(() => refused)
    registerSiteWorker(page('complete', register).host)
    await Promise.resolve()
    expect(register).toHaveBeenCalledTimes(1)
  })

  test('does nothing where the browser has no service worker', () => {
    const none = page('interactive')
    registerSiteWorker(none.host)
    expect(none.onLoad).toHaveLength(0)
  })
})
