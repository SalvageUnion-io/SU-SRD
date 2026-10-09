import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Throws, and so reaches Sentry, when Discord sign-in stops completing. See
// `authHealth.ts` for why this is an outcome check and not an error filter.
crons.hourly('discord sign-in health', { minuteUTC: 7 }, internal.authHealth.check)

export default crons
