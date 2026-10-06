import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

/**
 * Scheduled work on the deployment.
 *
 * One job: an email invite's address is kept only while the invite is live
 * (ADR-038 §5). Redeeming, declining and revoking forget it on the spot; an
 * invite that simply runs out has nobody to trigger that, so this does.
 */
const crons = cronJobs()

crons.daily(
  'forget the addresses of expired email invites',
  { hourUTC: 4, minuteUTC: 0 },
  internal.inviteEmail.forgetExpiredAddresses
)

export default crons
