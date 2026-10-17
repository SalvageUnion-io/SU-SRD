/**
 * srd's stylesheet entry rule — the `srd-css` rule set of `tools/check-rule-sets.ts`.
 *
 * `apps/web/ssg/DESIGN.md` states this as **hard rule 1**: all css is imported from
 * `src/runtime/styles.entry.ts`, which is a client-bundle entry and nothing
 * else, and `ssg/**`, `src/pages/**`, `src/layouts/BaseLayout.tsx` and
 * `src/runtime/Island.tsx` must stay stylesheet-free.
 *
 * ## The rule was enforced by nothing, in either direction
 *
 * `apps/web/CLAUDE.md` and `ssg/DESIGN.md` once said a stray `import './x.css'` in the SSR
 * graph **breaks the build**. It does not. Measured under this repo's Bun: a
 * `.css` import in an SSR module resolves and returns an object, exit 0 —
 * including a package import, and including a file with an unresolvable
 * `@import`. There was never a build failure to rely on.
 *
 * `ssg/build.ts` installs a `ssg-css-stub` plugin that resolves `.css` to an
 * empty module during the SSR pass. That plugin is not what removed the
 * failure; it made an already-silent behaviour deterministic, and its own
 * comment says so.
 *
 * So the actual risk is narrow and real: a `.css` import added to a **page or
 * SSR-only module** never reaches Vite, because the client bundle is fed only
 * from `styles.entry.ts`. Its authored rules — hand-written selectors,
 * keyframes, `@layer` blocks — simply never ship. The build is green, typecheck
 * is green, and nothing anywhere reports it.
 *
 * The `styling` rule set does not cover this either: its `dead-app-css`
 * rule looks for class selectors that are *unreferenced*, so a stylesheet whose
 * classes ARE referenced looks healthy while never being served.
 *
 * ## What this asserts
 *
 * 1. Exactly one module a static page reaches may import a stylesheet, and
 *    it is `src/runtime/styles.entry.ts`. "Reaches" is the relative-import
 *    graph from srd's own trees (`ssg/`, `src/pages/`, `src/endpoints/`,
 *    `src/layouts/`, `src/runtime/`), so a component a page renders is held
 *    to it too. A component-side `import './x.css'` on that graph rides into
 *    every page's bundle: that is how srd bundled, and its service worker
 *    precached, the dashboard's 20 KB of rules no page can use.
 * 2. A module only the builder reaches (its routes and the components they
 *    alone render) imports its own stylesheet: Vite code-splits it with the
 *    route, and `stylingOwnership` owns it.
 *
 */
import type { RuleSet } from '../lib/ruleEngine';
/** The one module allowed to import a stylesheet, repo-relative. */
export declare const SRD_CSS_ENTRY = "apps/web/src/runtime/styles.entry.ts";
export declare const srdCss: RuleSet;
