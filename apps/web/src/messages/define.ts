/**
 * The interface's words, held in one catalogue (ADR-053): every label,
 * heading, hint and line of chrome the app draws is a key in a module of
 * `src/messages/`, never a string typed at the call site. English is the
 * only language; the catalogue is the seam another one joins at.
 *
 * Rules text and game data are not here: they are the book's words, served
 * by `salvageunion-reference` and held to the book by the fidelity lock.
 *
 * A module of the catalogue names one area of the app and holds its words:
 *
 *   export const sheetCopy = messages({
 *     removeUnit: 'Remove unit',
 *     savedAt: 'Saved {time}',
 *   })
 *
 * and a component says them by key: `sheetCopy('removeUnit')`,
 * `sheetCopy('savedAt', { time })`. A `{name}` in a message is a value the
 * call must pass; the types refuse a missing one, an unknown key and a
 * value for a message that takes none. Keys are written out at the call
 * (the `ui-strings` gate refuses a computed one), so a key no call says is
 * found and dropped.
 */

/** The `{name}` placeholders in a message, as a union of names. */
type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}`
  ? P | Placeholders<Rest>
  : never

/** A value a placeholder takes; a missing one says nothing, as `{value}` in JSX would. */
type Value = string | number | null | undefined

type Values<S extends string> = [Placeholders<S>] extends [never]
  ? []
  : [values: Record<Placeholders<S>, Value>]

/** Says one module's messages by key. */
export type Translate<M extends Record<string, string>> = <K extends keyof M & string>(
  key: K,
  ...values: Values<M[K]>
) => string

const PLACEHOLDER = /\{(\w+)\}/g

/** A module of the catalogue: its messages, keyed, in English. */
export function messages<const M extends Record<string, string>>(catalogue: M): Translate<M> {
  return (key, ...[values]) => {
    const text = catalogue[key] as string
    if (!values) return text
    const given = values as Record<string, Value>
    return text.replace(PLACEHOLDER, (whole, name: string) =>
      name in given ? String(given[name] ?? '') : whole
    )
  }
}
