/**
 * styles.entry — the ONLY module in the app that imports `.css`.
 *
 * The SSR pass runs under Bun and does not go through Vite, so a `.css` import
 * reachable from an SSR module is a build hazard. This file is a client-bundle
 * entry and nothing else; `BaseLayout.tsx`, the page modules and everything
 * under `ssg/` must stay free of stylesheet imports. See `ssg/DESIGN.md`,
 * hard rule 1.
 *
 * The fonts and the package stylesheet are not here: they are the base
 * stylesheet both apps share (`src/styles/base.css`), linked on its own.
 */

import '../styles/global.css'
