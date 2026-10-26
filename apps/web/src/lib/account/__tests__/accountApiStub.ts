/**
 * `accountApi` for a component test, through `installConvexMocks`' `also`
 * (`'../../lib/account/accountApi': accountApiStub`): each read answers what
 * `accountAnswers` holds, and each write is a spy that lands unless
 * `accountFailures` names it. Reset both in `afterEach` (`resetAccountApi`).
 */

import type { AccountExport } from '../../../worker/accountRoutes'
import type { AdminMetrics, MeAnswer } from '../accountApi'

export const accountAnswers: {
  /** A test's player needs only the fields its screen reads. */
  me?: Partial<NonNullable<MeAnswer>> | null
  exported?: AccountExport
  metrics?: AdminMetrics
} = {}

/** What each write throws this test, by hook name; a write not named lands. */
export const accountFailures: Partial<
  Record<'updateProfile' | 'submitFeedback' | 'refreshMetrics', unknown>
> = {}

/** How many times a mounted screen asked who the player is. */
export const accountReads = { me: 0 }

/** Every write this test made, in order: the hook's name and its argument. */
const accountWrites: { name: string; args: unknown }[] = []

function write(name: keyof typeof accountFailures) {
  return async (args?: unknown) => {
    accountWrites.push({ name, args })
    if (name in accountFailures) throw accountFailures[name]
    return null
  }
}

export function resetAccountApi(): void {
  for (const key of Object.keys(accountAnswers))
    delete (accountAnswers as Record<string, unknown>)[key]
  for (const key of Object.keys(accountFailures))
    delete (accountFailures as Record<string, unknown>)[key]
  accountWrites.length = 0
  accountReads.me = 0
}

/** A complete `accountApi` module body. */
export function accountApiStub() {
  return {
    useMe: (enabled = true) => {
      if (!enabled) return undefined
      accountReads.me += 1
      return accountAnswers.me as MeAnswer | undefined
    },
    useAccountExport: () => accountAnswers.exported,
    useAdminMetrics: () => accountAnswers.metrics,
    useUpdateProfile: () => write('updateProfile'),
    useSubmitFeedback: () => write('submitFeedback'),
    useRefreshMetrics: () => write('refreshMetrics'),
    askFloor: async () => undefined,
  }
}
