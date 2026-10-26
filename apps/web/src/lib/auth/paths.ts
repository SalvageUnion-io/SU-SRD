/** The sign-in's addresses on the site, served by the Worker (`src/worker/auth/`). */
export const AUTH_PATHS = {
  /** `GET ?to=<site path>`: off to Discord, back to `to`. */
  signIn: '/auth/sign-in',
  /** `GET`: Discord's redirect back. */
  callback: '/auth/callback',
  /** `GET`: who is signed in (`SessionAnswer`), or a 401. */
  session: '/auth/session',
  /** `POST`: ends the session. */
  signOut: '/auth/sign-out',
  /** `POST {email, password, flow}`: the test seam, only where `TEST_AUTH` is set. */
  testSignIn: '/auth/test-sign-in',
  /** `POST`: deletes everything the account holds, then its sign-in and every session. */
  deleteAccount: '/auth/delete-account',
} as const

export const AUTH_PREFIX = '/auth/'

/** What `session` answers when signed in. */
export type SessionAnswer = {
  /** The account's id (`accounts.account_id`). */
  account: string
  /** Who the rooms and the shared database name this player as: their Discord id (`identityOf`). */
  person: string
}
