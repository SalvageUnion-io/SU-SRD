import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Throws, and so reaches Workers Issues, when Discord sign-in stops completing. See
// `authHealth.ts` for why this is an outcome check and not an error filter.
crons.hourly('discord sign-in health', { minuteUTC: 7 }, internal.authHealth.check)

// Deletes uploaded photos whose entity write never landed. See `photos.ts`.
crons.hourly('unused photo sweep', { minuteUTC: 37 }, internal.photos.sweep)

// The day's usage totals for the admin page and the Monday report. See `metrics.ts`.
crons.daily('usage metrics tally', { hourUTC: 5, minuteUTC: 13 }, internal.metrics.tally, {})

// Files waiting feedback as GitHub issues and drops a day-old row. See `feedback.ts`.
crons.hourly('feedback sweep', { minuteUTC: 23 }, internal.feedback.sweep, {})

export default crons
