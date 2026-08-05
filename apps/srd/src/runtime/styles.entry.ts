/**
 * styles.entry — the ONLY module in the app that imports `.css`.
 *
 * The SSR pass runs under Bun and does not go through Vite, so a `.css` import
 * reachable from an SSR module is a build hazard. This file is a client-bundle
 * entry and nothing else; `BaseLayout.tsx`, the page modules and everything
 * under `ssg/` must stay free of stylesheet imports. See `ssg/DESIGN.md`,
 * hard rule 1.
 */

import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import '../styles/global.css'
