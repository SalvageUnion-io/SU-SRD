// Registers the service worker that `ssg/pwa.ts` configures. Loaded by
// `src/layouts/BaseLayout.tsx` with `<script defer src="/registerSW.js">`.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Load-bearing. `register()` rejects for reasons outside this site's
      // control (service workers disabled, a locked-down profile, an extension
      // intercepting the request), and unhandled each one reached Sentry as
      // `Error: Rejected` (SRD-2). Offline caching is a progressive
      // enhancement: there is no fallback to attempt and nothing to tell the user.
    })
  })
}
