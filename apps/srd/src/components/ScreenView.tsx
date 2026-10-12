import { Button } from 'component-lib'
import { NO_EFFECT } from 'salvageunion-reference'
import { rangeLabel, rowForRoll } from '../lib/rollTablePage'
import type { ScreenReference, ScreenTable } from '../lib/screenPage'
import { MentionProse } from './MentionProse'
import { RollBands } from './RollBands'

/**
 * The Mediator Screen's panels (`/screen/`): each table the Quick Reference
 * Sheet sets on its first page, at a glance, with a Roll that marks its row
 * where the table sits. A table's bands are the roll-table page's own
 * (`RollBands`), at `compact`.
 *
 * Presentational, so the server and the island draw the same panel: the
 * server renders a table with no roll and an inert button (the bands are real
 * content for a crawler or a no-JS reader), and `ScreenTableIsland` mounts it
 * live.
 */

/** A panel's head: the Quick Ref section, the entry's name linked to its page, and the page it cites. */
function PanelHead({ panel }: { panel: ScreenTable | ScreenReference }) {
  return (
    <header className="srd-screen__head">
      <span className="srd-screen__section">{panel.section}</span>
      <h2 id={panel.id} className="srd-screen__title">
        <a href={panel.href} className="su-hit-area">
          {panel.title}
        </a>
      </h2>
      {panel.page > 0 && <span className="srd-screen__page">p.{panel.page}</span>}
    </header>
  )
}

type ScreenTableViewProps = {
  panel: ScreenTable
  /** The roll the table reads, or `null` before the first one. */
  roll: number | null
  /** Roll the die. Absent on the server, where the button is inert. */
  onRoll?: () => void
}

export function ScreenTableView({ panel, roll, onRoll }: ScreenTableViewProps) {
  const { data } = panel
  const hit = roll === null ? undefined : rowForRoll(data.table, data.rows, roll)
  const outcome = hit ? (hit.label ?? rangeLabel(hit.key)) : NO_EFFECT

  return (
    <section className="srd-screen__panel" aria-labelledby={panel.id}>
      <PanelHead panel={panel} />
      <div className="srd-screen__controls">
        <Button
          variant="primary"
          size="compact"
          onClick={onRoll}
          disabled={!onRoll}
          aria-label={`Roll on ${panel.title}`}
        >
          {roll === null ? 'Roll' : 'Roll again'}
        </Button>
        <p aria-live="polite" className="srd-screen__result">
          {roll !== null && (
            <>
              <span className="srd-screen__number">{roll}</span> {outcome}
            </>
          )}
        </p>
      </div>
      <div className="srd-screen__table">
        <RollBands name={panel.title} rows={data.rows} roll={roll} hit={hit} size="compact" />
      </div>
    </section>
  )
}

/** A panel of rules to read, not roll: Heat, the distances, the Downtime procedure. */
export function ScreenReferenceView({ panel }: { panel: ScreenReference }) {
  return (
    <section className="srd-screen__panel" aria-labelledby={panel.id}>
      <PanelHead panel={panel} />
      {panel.notes.length > 0 && (
        <dl className="srd-screen__notes">
          {panel.notes.map((note) => (
            <div key={note.term} className="srd-screen__note">
              <dt className="srd-screen__term">{note.term}</dt>
              <dd className="srd-screen__text">
                <MentionProse parts={note.text} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {panel.steps.map((steps) => (
        <div key={steps.heading} className="srd-screen__steps">
          {steps.heading && <h3 className="srd-screen__term">{steps.heading}</h3>}
          <ol className="srd-screen__step-list">
            {steps.names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
