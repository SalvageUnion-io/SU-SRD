import { InlineRef } from 'component-lib'
import type { ReactNode } from 'react'

type RollPanelProps = {
  /** The table's name, beside "You rolled". */
  name: string
  /** The readout of the current roll, or absent to show `prompt`. */
  result?: ReactNode
  /** What the panel says before there is a result to read. */
  prompt: ReactNode
  /** The earlier rolls, newest first: the number and what it read as. */
  history: { n: number; label: string }[]
  /** The page's density setting (`rollTableDensity`, or always `compact`). */
  density: string
  /** The table's prose, a paragraph each, over the instrument. */
  description: readonly string[]
  /** The page's main column under the prose: the table's instrument. */
  children: ReactNode
}

/**
 * The roll pages' shared frame (board 08b): the "You rolled" panel (the
 * result and the earlier rolls) beside the main column, which ends in the
 * Randsum credit, set very small under the table. The panel has no button:
 * the table's own Roll the Die button is the roll (`RollTableInstrument`'s `onRoll`), and the result is
 * announced here, in the panel's polite live region. `RollTableView` and
 * `ColumnsTableView` differ only in what they put in it.
 */
export function RollPanel({
  name,
  result,
  prompt,
  history,
  density,
  description,
  children,
}: RollPanelProps) {
  return (
    <div className="srd-roll" data-density={density}>
      <section className="srd-roll__panel" aria-labelledby="roll-panel-title">
        <div className="srd-roll__panel-head">
          <h2 id="roll-panel-title" className="srd-roll__panel-title">
            You rolled
          </h2>
          <span className="srd-roll__panel-name">{name}</span>
        </div>

        <div aria-live="polite" className="srd-roll__result">
          {result ?? <p className="srd-roll__prompt">{prompt}</p>}
        </div>

        {history.length > 0 && (
          <div className="srd-roll__earlier">
            <h3 className="srd-roll__earlier-title">Earlier rolls</h3>
            <ol className="srd-roll__earlier-list">
              {history.map(({ n, label }, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a roll history repeats values; its position is its identity
                <li key={index} className="srd-roll__earlier-row">
                  <span className="srd-roll__earlier-n">{n}</span>
                  <span className="srd-roll__earlier-outcome">{label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <div className="srd-roll__main">
        {description.map((paragraph) => (
          <p key={paragraph} className="srd-roll__description">
            {paragraph}
          </p>
        ))}
        {children}
        <p className="srd-roll__credit">
          Dice rolling powered by{' '}
          <InlineRef href="https://randsum.dev" target="_blank" rel="noopener noreferrer">
            Randsum.dev
          </InlineRef>
        </p>
      </div>
    </div>
  )
}

/**
 * The current roll's readout: the number, then where it landed (`lands`, when
 * the roll hit a row or column) over the outcome's title.
 */
export function RollReadout({
  n,
  lands,
  title,
}: {
  n: number
  lands?: { label: string; range: string }
  title: ReactNode
}) {
  return (
    <div className="srd-roll__readout">
      <span className="srd-roll__number">{n}</span>
      <div className="srd-roll__outcome">
        {lands && (
          <span className="srd-roll__lands">
            <span className="srd-roll__lands-label">{lands.label}</span>
            <span className="srd-roll__lands-range">{lands.range}</span>
          </span>
        )}
        <span className="srd-roll__outcome-title">{title}</span>
      </div>
    </div>
  )
}
