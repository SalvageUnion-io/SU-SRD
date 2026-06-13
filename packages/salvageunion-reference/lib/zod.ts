/**
 * Pre-configured Zod instance.
 *
 * Disables Zod v4's JIT object parser. The JIT path compiles validators with
 * `new Function`, and a `new Function("")` eval feature-detect (`allowsEval`)
 * runs at schema *construction* time. Both trip a strict `script-src`
 * Content-Security-Policy with no `unsafe-eval` (see apps/suref-web/netlify.toml),
 * surfacing as console CSP violations in the browser. The jitless interpreted
 * parser produces identical results, just slightly slower.
 *
 * Import `z` from this module (never directly from `zod`) anywhere schemas are
 * constructed or parsed, so `z.config` runs before the first `z.object()` call.
 */
import { z } from 'zod'

z.config({ jitless: true })

export { z }
