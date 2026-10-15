/**
 * The production origin: `salvageunion.io`, where the reference pages, the
 * JSON API and the Cantina (under `/build`) are served. Every workspace that
 * writes an absolute link to it (the app, the Discord bot, the gallery, this
 * package's JSON Schema `$id`s) reads this constant rather than retyping the
 * host.
 *
 * A leaf module with no imports, so the JSON Schema generator can read it
 * before the schemas it writes exist.
 */
export const SRD_SITE_URL = 'https://salvageunion.io'
