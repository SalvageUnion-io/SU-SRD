import { e2eConfig } from 'gates/playwright'

/**
 * srd's end-to-end suite: `packages/gates/lib/playwrightBase.ts` with srd's port and
 * budget. Islands download the salvageunion-reference data chunks on first
 * intent, so a cold navigation can take a while; 60 s leaves headroom without
 * masking a real hang.
 */
export default e2eConfig({ port: 4321, local: { timeout: 60_000, expect: 15_000 } })
