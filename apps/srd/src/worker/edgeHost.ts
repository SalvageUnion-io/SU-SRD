/**
 * Spike O3 (docs/spikes/o3-one-edge-worker.md): what the srd Worker would do
 * if `api.salvageunion.io` were attached to it instead of to a fifth Worker
 * (ADR-043 decision 1). UNWIRED: `index.ts` does not import this, and no
 * route sends `api.` here, until the owner decides.
 *
 * Static Assets answers first and knows nothing of hosts, so the two hosts
 * share one `dist/`. Path-disjoint files need no script: the `/v1/*` tree
 * exists only for the API, srd's pages only for srd. A path both hosts claim
 * (`EDGE_SHARED_PATHS`) runs the script first (`assets.run_worker_first`) and
 * is answered here: srd's file as itself, the API's from `API_HOST_DIR`.
 * Every other request reaching the script is a miss, answered per host.
 */

/** Which site a request is for. Anything but the API host is srd (apex, www, workers.dev, localhost). */
export type EdgeHost = 'srd' | 'api'

/** @public Spike O3, unwired until the owner decides (see the file comment). */
export const API_HOSTNAME = 'api.salvageunion.io'

/** Where the API host's copies of `EDGE_SHARED_PATHS` live in `dist/`. */
export const API_HOST_DIR = '/_api'

/**
 * Paths both hosts serve with different bytes. Each becomes a
 * `run_worker_first` pattern, so each srd hit on one costs a Worker request
 * against the Free quota: keep it to these.
 *
 * @public Spike O3, unwired until the owner decides (see the file comment).
 */
export const EDGE_SHARED_PATHS: readonly string[] = ['/', '/llms.txt', '/robots.txt']

export function edgeHostOf(hostname: string): EdgeHost {
  return hostname.toLowerCase() === API_HOSTNAME ? 'api' : 'srd'
}

export type EdgePlan =
  /** Fetch this path through the asset binding (`_headers` applies to it). */
  | { serve: 'asset'; path: string }
  /** No file: the host's own uncacheable 404. */
  | { serve: 'miss'; host: EdgeHost }

/**
 * The decision for a request that reached the script.
 *
 * @public Spike O3, unwired until the owner decides (see the file comment).
 */
export function planEdgeRequest(url: URL): EdgePlan {
  const host = edgeHostOf(url.hostname)
  if (EDGE_SHARED_PATHS.includes(url.pathname)) {
    if (host === 'srd') return { serve: 'asset', path: url.pathname }
    return { serve: 'asset', path: `${API_HOST_DIR}${url.pathname}` }
  }
  return { serve: 'miss', host }
}
