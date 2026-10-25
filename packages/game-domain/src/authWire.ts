/**
 * The sign-in's wire: what the site Worker mints (`apps/web/src/worker/auth/`)
 * and what Convex accepts (`apps/web/convex/auth.config.ts`,
 * `apps/web/convex/accountLink.ts`). A leaf, so the Worker and the Convex
 * bundle read one declaration.
 *
 * Two issuers, one key. A session token's subject is `<userId>|<sessionId>`,
 * the shape `getAuthUserId` reads, so every Convex function keeps working. A
 * link token's subject is the account's sign-in (`discord:<id>` or
 * `test:<email>`), and only `accountLink.link` takes it: the Worker sends it
 * server to server and never hands it to a browser.
 */

/** The `iss` of a session token. A name, not an address: no request goes there. */
export const SESSION_ISSUER = 'https://salvageunion.io'

/** The `iss` of a link token. */
export const LINK_ISSUER = 'https://salvageunion.io/link'

/** The `aud` of both: the `applicationID` Convex checks. */
export const TOKEN_AUDIENCE = 'convex'

/** How a link token's subject names a Discord account. */
export const DISCORD_SUBJECT = 'discord:'

/** How a link token's subject names a test account (`TEST_AUTH` only). */
export const TEST_SUBJECT = 'test:'
