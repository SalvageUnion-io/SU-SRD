/**
 * Where the Worker answers what crosses rooms (`worker/sharedRoutes.ts`):
 * public sheets and their previews, invite previews, Homebrew's standing,
 * reports and moderation, and the patterns a crew shares. Shared by the Worker
 * and the app, so the two cannot disagree on an address.
 *
 * Every answer is JSON: `{ value }`, or `{ refusal }` with a 4xx the player
 * can read.
 */

export { PHOTOS_PATH, photoPath } from 'game-domain/schemas/photo'

export const SHARED_PATH = '/__shared'

const part = encodeURIComponent

export const sharedPaths = {
  /** `GET`: a shared thing's page, as a stranger reads it. */
  sheet: (kind: string, segment: string) => `${SHARED_PATH}/sheets/${part(kind)}/${part(segment)}`,
  /** `GET`: a shared thing's link preview. */
  preview: (kind: string, segment: string) =>
    `${SHARED_PATH}/previews/${part(kind)}/${part(segment)}`,
  /** `GET`: what an invite's preview may say. */
  invite: (code: string) => `${SHARED_PATH}/invites/${part(code)}`,
  /** `GET`: one pattern's place in Homebrew, for the reader. */
  homebrew: (appId: string) => `${SHARED_PATH}/homebrew/${part(appId)}`,
  /** `POST { reason }`: report it. */
  report: (appId: string) => `${SHARED_PATH}/homebrew/${part(appId)}/report`,
  /** `POST { hidden }`: a site admin hides it, or puts it back. */
  hidden: (appId: string) => `${SHARED_PATH}/homebrew/${part(appId)}/hidden`,
  /** `POST`: a site admin clears its reports. */
  dismiss: (appId: string) => `${SHARED_PATH}/homebrew/${part(appId)}/dismiss`,
  /** `GET`: the site admin's queue; null for anyone else. */
  moderation: () => `${SHARED_PATH}/moderation`,
  /** `GET`: the patterns crewmates shared with the reader's Games. */
  crewPatterns: () => `${SHARED_PATH}/crew-patterns`,
  /** `GET`: the patterns crewmates shared with one of the reader's Games. */
  gamePatterns: (gameId: string) => `${SHARED_PATH}/games/${part(gameId)}/patterns`,
} as const
