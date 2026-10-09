/**
 * The oldest client build this backend still serves writes to, as the commit
 * time (Unix seconds) of the build it was deployed with.
 *
 * GENERATED AT DEPLOY TIME. `deploy-cloudflare.yml`'s `push-convex` job
 * overwrites this file with the deployed commit's stamp immediately before
 * `convex deploy`, so the floor moves with the very push that may have removed
 * a function an older client still calls. The committed `0` is "no floor":
 * what a dev deployment, the nightly e2e backend and the unit tests run with.
 * Read it through `build.floor`, never directly from the client.
 */
export const BUILD_FLOOR = 0
