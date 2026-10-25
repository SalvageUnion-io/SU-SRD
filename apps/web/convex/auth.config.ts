import { LINK_ISSUER, SESSION_ISSUER, TOKEN_AUDIENCE } from 'game-domain/authWire'

/**
 * The tokens Convex accepts: the site Worker's (`src/worker/auth/`), ES256,
 * checked against `AUTH_JWKS`, the public half of the Worker's
 * `AUTH_SIGNING_KEY` as a data URI (`bun scripts/authKeys.ts`). A session
 * token's subject is `<userId>|<sessionId>`, what `getAuthUserId` reads; a
 * link token is only `accountLink.link`'s. Without `AUTH_JWKS` nobody signs in.
 */
const jwks = process.env.AUTH_JWKS

export default {
  providers: jwks
    ? [SESSION_ISSUER, LINK_ISSUER].map((issuer) => ({
        type: 'customJwt' as const,
        applicationID: TOKEN_AUDIENCE,
        issuer,
        jwks,
        algorithm: 'ES256' as const,
      }))
    : [],
}
