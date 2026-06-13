/**
 * ADR (inline) — chose vite-plugin-pwa over hand-written SW
 *
 * Decision: use vite-plugin-pwa (via workbox) for app-shell caching.
 *
 * Rationale:
 *   - vite-plugin-pwa generates the SW + web manifest from Vite's build
 *     output automatically, so the precache list stays in sync with every
 *     bundle Vite emits. A hand-written SW would need manual maintenance of
 *     every emitted filename (content-hashed), which drifts silently.
 *   - Wraps workbox under the hood — proven cache-first strategy for app
 *     shells with automatic stale-while-revalidate semantics.
 *   - registerType: 'autoUpdate' in vite.config.ts silently swaps in new
 *     SW versions on next page load, appropriate for a local-first app with
 *     no server-coordinated deploys required.
 *   - The plugin also auto-injects registration into the built index.html,
 *     but this file provides an explicit registration call so the boot
 *     sequence is visible in main.tsx rather than hidden in injected HTML.
 *   - Hand-written SW alternative would require: manual glob patterns,
 *     cache versioning, skipWaiting/clientsClaim logic — all solved by
 *     workbox already.
 *
 * Trade-offs accepted:
 *   - SW is skipped in DEV mode so HMR works correctly (see guard below).
 *   - Icons are placeholders for M1; replace before M3 launch.
 *   - registerType: 'autoUpdate' means the user gets the new version
 *     automatically; no prompt is shown. Acceptable for a local-first app.
 *   - We register `/sw.js` directly (the workbox output filename from
 *     vite-plugin-pwa) rather than importing `virtual:pwa-register`, because
 *     the virtual module only resolves in Vite's build context and cannot be
 *     mocked in Bun's test runner without modifying bunfig.toml (which is
 *     frozen by Wave 1). Direct registration is functionally equivalent since
 *     `registerType: 'autoUpdate'` configures the same workbox options.
 */

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) {
    // Skip SW registration in development so Vite HMR is not disrupted.
    return
  }

  // Check both key existence and value truthiness: happy-dom and some
  // older browser stubs set `navigator.serviceWorker = undefined`.
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker) {
    return
  }

  // Register the workbox-generated SW produced by vite-plugin-pwa.
  // The SW filename 'sw.js' is the default output from vite-plugin-pwa
  // when no custom filename is configured.
  void navigator.serviceWorker.register('/sw.js', { scope: '/' })
}
