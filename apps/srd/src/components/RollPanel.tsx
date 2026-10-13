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
  /** The page's main column: the table's prose and its instrument. */
  children: ReactNode
}

/**
 * The roll pages' shared frame (board 08b): the "You rolled" panel (the
 * Randsum credit fixed under its head, then the result and the earlier rolls)
 * beside the main column. The panel has no button: the table's own ROLL THE
 * DIE stamp is the roll (`RollTableInstrument`'s `onRoll`), and the result is
 * announced here, in the panel's polite live region. `RollTableView` and
 * `ColumnsTableView` differ only in what they put in it.
 */
export function RollPanel({ name, result, prompt, history, density, children }: RollPanelProps) {
  return (
    <div className="srd-roll" data-density={density}>
      <section className="srd-roll__panel" aria-labelledby="roll-panel-title">
        <div className="srd-roll__panel-head">
          <h2 id="roll-panel-title" className="srd-roll__panel-title">
            You rolled
          </h2>
          <span className="srd-roll__panel-name">{name}</span>
        </div>

        <div className="srd-roll__controls">
          <p className="srd-roll__credit">
            Dice rolling powered by{' '}
            <InlineRef href="https://randsum.dev" target="_blank" rel="noopener noreferrer">
              Randsum.dev
            </InlineRef>
          </p>
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

      <div className="srd-roll__main">{children}</div>
    </div>
  )
}
