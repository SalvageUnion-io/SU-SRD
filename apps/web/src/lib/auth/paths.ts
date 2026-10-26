/** The sign-in's addresses on the site, served by the Worker (`src/worker/auth/`). */
export const AUTH_PATHS = {
  /** `GET ?to=<site path>`: off to Discord, back to `to`. */
  signIn: '/auth/sign-in',
  /** `GET`: Discord's redirect back. */
  callback: '/auth/callback',
  /** `GET`: the session's short-lived token for Convex, or a 401. */
  token: '/auth/token',
  /** `POST`: ends the session. */
  signOut: '/auth/sign-out',
  /** `POST {email, password, flow}`: the test seam, only where `TEST_AUTH` is set. */
  testSignIn: '/auth/test-sign-in',
  /** `POST`: deletes the account on Convex, then its sign-in and every session. */
  deleteAccount: '/auth/delete-account',
} as const

export const AUTH_PREFIX = '/auth/'

/** What `token` answers when signed in. */
export type TokenAnswer = {
  token: string
  /** The Convex account id, the subject's first half. */
  account: string
  /** Who the rooms and the shared database name this player as: their Discord id (`identityOf`). */
  person: string
}
