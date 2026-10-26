/**
 * What the Worker's JSON routes say when they refuse (`../sharedRoutes.ts`,
 * `../photos.ts`): the words a player reads, kept beside the shared database's
 * own, as the rooms keep theirs.
 */

export const REFUSALS = {
  signIn: 'Sign in first',
  adminsOnly: 'Only a site admin can do that',
  notFound: 'Not found',
  unreadable: 'That could not be read. Try again.',
  photosUnset: 'Photos are not set up here',
  notAPhoto: 'A photo must be a WebP, JPEG or PNG image under 4 MB.',
} as const

/** A file whose address is never reused: any cache may keep it for a year. */
export const IMMUTABLE = 'public, max-age=31536000, immutable'
