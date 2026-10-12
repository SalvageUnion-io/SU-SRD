import { describe, expect, it } from 'bun:test'
import { API_HOST_DIR, EDGE_SHARED_PATHS, edgeHostOf, planEdgeRequest } from '../edgeHost'

/** Spike O3: the host plan a single salvageunion.io edge Worker would run. */

const plan = (url: string) => planEdgeRequest(new URL(url))

describe('edgeHostOf', () => {
  it('names only the API host as the API', () => {
    expect(edgeHostOf('api.salvageunion.io')).toBe('api')
    expect(edgeHostOf('API.salvageunion.io')).toBe('api')
  })

  it('treats the apex, www, workers.dev and localhost as srd', () => {
    for (const host of [
      'salvageunion.io',
      'www.salvageunion.io',
      'su-srd.alxjrvs.workers.dev',
      'localhost',
    ]) {
      expect(edgeHostOf(host)).toBe('srd')
    }
  })

  it('does not take a lookalike host for the API', () => {
    expect(edgeHostOf('api.salvageunion.io.evil.example')).toBe('srd')
  })
})

describe('planEdgeRequest — paths both hosts claim', () => {
  it('serves srd its own file unchanged', () => {
    for (const path of EDGE_SHARED_PATHS) {
      expect(plan(`https://salvageunion.io${path}`)).toEqual({ serve: 'asset', path })
    }
  })

  it("serves the API host its copy from the API's directory", () => {
    expect(plan('https://api.salvageunion.io/')).toEqual({
      serve: 'asset',
      path: `${API_HOST_DIR}/`,
    })
    expect(plan('https://api.salvageunion.io/llms.txt')).toEqual({
      serve: 'asset',
      path: `${API_HOST_DIR}/llms.txt`,
    })
    expect(plan('https://api.salvageunion.io/robots.txt')).toEqual({
      serve: 'asset',
      path: `${API_HOST_DIR}/robots.txt`,
    })
  })

  it('keeps the shared list to the three paths that differ', () => {
    // Each entry is a run_worker_first pattern: a Worker request on every srd
    // hit. Growing it is a quota decision, not a refactor.
    expect(EDGE_SHARED_PATHS).toEqual(['/', '/llms.txt', '/robots.txt'])
  })
})

describe('planEdgeRequest — misses', () => {
  it("answers a miss with the requesting host's 404", () => {
    expect(plan('https://salvageunion.io/nope/')).toEqual({ serve: 'miss', host: 'srd' })
    expect(plan('https://api.salvageunion.io/v1/nope.json')).toEqual({
      serve: 'miss',
      host: 'api',
    })
  })

  it('never maps a non-shared API path into the API directory', () => {
    expect(plan('https://api.salvageunion.io/_api/')).toEqual({ serve: 'miss', host: 'api' })
  })
})
