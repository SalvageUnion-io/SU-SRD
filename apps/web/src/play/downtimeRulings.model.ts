/**
 * The owner's rulings on round seven's Downtime and salvage fixes, each one
 * constant (r7 D1, D3, D8). Each holds the Recommended choice; flipping one
 * switches the behaviour wherever it is read.
 */

/**
 * D1: solo Downtime's forward button. `'apply'` (built): it reads "Apply and
 * go on", applies the step's proposed numbers (with Undo) and moves on; "Skip
 * this step" is a small link. `'skip'`: forward walks past unapplied as
 * before, labelled "Skip step N", with Apply & mark done its own press.
 */
export const DOWNTIME_FORWARD: 'apply' | 'skip' = 'apply'

/**
 * D3: a Game's step that every seat has finished, or that nobody can act in
 * (Trade and Craft with no crawler, Tally Salvage with no Scrap carried),
 * moves on by itself on the Mediator's screen; the Mediator may step back,
 * and a step stepped back to waits for their Next. `false`: Next stays the
 * Mediator's press on every step.
 */
export const DOWNTIME_AUTO_PASS = true

/**
 * D8: a wreck's rolled part. `'crew'` (built): it goes to the table as a
 * proposal any player answers, or changes to another part, as damage does.
 * `'mediator'`: the Mediator picks and takes it, and the Feed says which.
 */
export const WRECK_PART_PICK: 'crew' | 'mediator' = 'crew'
