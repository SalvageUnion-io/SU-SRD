# Cycle 2 — Track B: Offline Service Worker

**Run ID**: 2026-05-18-itun-revamp-wave-2
**Branch**: run/2026-05-18-itun-revamp-wave-2/cycle-2
**ACs covered**: AC-4, AC-5
**Issue**: #186

## Summary

Added offline app-shell caching via vite-plugin-pwa. The service worker is
registered at boot from `main.tsx`, caches HTML/JS/CSS/asset bundles, and
enables the app to load fully offline after first visit. Registration is
skipped in DEV mode and when `navigator.serviceWorker` is unavailable.

## Files Touched

| File | Action |
|------|--------|
| `apps/in-the-union-now/package.json` | Added `vite-plugin-pwa@1.3.0` devDep |
| `apps/in-the-union-now/vite.config.ts` | Added `VitePWA()` plugin with manifest + workbox config |
| `apps/in-the-union-now/src/lib/sw/register.ts` | New: registration helper with inline ADR comment |
| `apps/in-the-union-now/src/lib/sw/__tests__/register.test.ts` | New: guard logic smoke tests (3 tests) |
| `apps/in-the-union-now/src/lib/sw/__mocks__/pwa-register.ts` | Stub — documents virtual module, excluded via knip.json ignore |
| `apps/in-the-union-now/src/vite-pwa.d.ts` | New: triple-slash ref for vite-plugin-pwa type declarations |
| `apps/in-the-union-now/src/main.tsx` | Added import + `registerServiceWorker()` call after render |
| `apps/in-the-union-now/public/icon-192.png` | Placeholder 192×192 PNG (replace before M3 launch) |
| `apps/in-the-union-now/public/icon-512.png` | Placeholder 512×512 PNG (replace before M3 launch) |
| `knip.json` | Added `ignore` for `__mocks__/**`, removed redundant `ignoreDependencies` entries |
| `bun.lock` | Updated (vite-plugin-pwa + workbox-build + workbox-window added) |

## AC Coverage

### AC-4: Service worker caches app shell (HTML, JS, CSS bundles)

- vite-plugin-pwa configured in `vite.config.ts` with `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`
- Build output confirms: **9 entries precached (568.56 KiB)**, `dist/sw.js` + `dist/workbox-*.js` generated
- Web manifest included with name, short_name, description, theme_color, icons

### AC-5: main.tsx registers the service worker at boot

- `registerServiceWorker()` imported and called in `src/main.tsx` after `createRoot().render()`
- 3 smoke tests pass: DEV guard, unavailable SW guard, multiple-call idempotency
- Manual offline checklist in PR description (below)

## Verification

```
bun --filter in-the-union-now typecheck   → exit 0 (628ms)
bun --filter in-the-union-now test        → 105 pass, 0 fail
bun --filter in-the-union-now build       → ✓ built + PWA v1.3.0: 9 entries precached
bun run check:all                         → exit 0 (all steps green)
```

## ADR — vite-plugin-pwa vs hand-written SW

**Decision**: vite-plugin-pwa (via workbox generateSW mode)

**Rationale**:
1. Precache list auto-syncs with Vite's build manifest — hand-written SW needs manual maintenance of content-hashed filenames
2. Workbox provides proven cache-first strategy with skipWaiting/clientsClaim
3. `registerType: 'autoUpdate'` handles SW lifecycle (activate, skip waiting) without custom logic
4. ~5 lines of config in vite.config.ts; thin abstraction, easy to eject to `injectManifest` mode if custom SW logic is needed later

**Trade-off — virtual:pwa-register not used**:
The `virtual:pwa-register` module (the vite-plugin-pwa recommended integration) only exists in Vite's build context. Bun's test runner cannot resolve virtual modules, and `bunfig.toml` is frozen by Wave 1 (cannot add preload stubs). Instead, `register.ts` calls `navigator.serviceWorker.register('/sw.js', { scope: '/' })` directly — functionally equivalent since `registerType: 'autoUpdate'` configures the same workbox options via the Vite plugin.

## Notes

- **Icon placeholders**: `public/icon-192.png` and `public/icon-512.png` are minimal valid PNGs. Replace with real ITUN artwork before M3 launch.
- **DEV mode**: SW registration is skipped when `import.meta.env.DEV === true` to avoid disrupting Vite HMR.
- **Test coverage**: Guard paths (DEV + unavailable SW) are tested. The `navigator.serviceWorker.register('/sw.js')` call is not covered in automated tests because the DEV guard fires first in Bun's test runner. This is documented in the test file and captured in the manual checklist below.
- **knip.json**: Added `ignore` for `src/lib/sw/__mocks__/**` (untracked stub file retained as documentation; excluded from cycle commit).

## Manual Test Checklist (for PR description)

- [ ] Run `bun --filter in-the-union-now build` — confirm PWA v1.3.0 shows 9+ precached entries
- [ ] Serve `dist/` with `npx serve dist/` or equivalent
- [ ] Open the app in Chrome DevTools → Application → Service Workers — confirm `sw.js` is registered
- [ ] Navigate to Application → Cache Storage — confirm app-shell assets are cached
- [ ] Enable "Offline" in DevTools Network tab
- [ ] Reload the page — confirm app loads fully without network
- [ ] Disable "Offline" — confirm normal operation resumes
- [ ] Confirm web manifest in Application → Manifest shows correct name/icons
