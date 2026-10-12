import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Throws, and so reaches Sentry, when Discord sign-in stops completing. See
// `authHealth.ts` for why this is an outcome check and not an error filter.
crons.hourly('discord sign-in health', { minuteUTC: 7 }, internal.authHealth.check)

// Deletes uploaded photos whose entity write never landed. See `photos.ts`.
crons.hourly('unused photo sweep', { minuteUTC: 37 }, internal.photos.sweep)

export default crons
