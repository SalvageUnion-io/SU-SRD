import type { ElementType } from 'react'
import { Slab } from '../../chrome/Slab'
import { RollTable } from '../../shared/RollTable'
import type { CardProseContext } from './CardProse'
import { CardProse } from './CardProse'
import { cardKey } from './cardHelpers'
import type { NestedCard } from './referenceEntityCardTypes'
import type { ResolvedGuideStep } from './resolveGuideSteps'

/**
 * GUIDE STEPS — a guide keeps almost all of its prose in `steps` (28.7k of
 * 34.2k characters across the dataset), so a card that renders only the
 * top-level `content` renders almost none of the guide: the "Salvaging" page
 * was a heading and a source line with all 3.7k characters of its rules
 * missing. Each step is a dashed `Slab` (its name) + its prose, with the
 * entities it selects from and its roll table rendered through the same
 * primitives every other section uses. A `section` opens a solid `Slab`
 * above it — those are the book's major divisions ("Post-Session Downtime").
 *
 * Read-only by design: this is the SRD's transcription of the procedure.
 * Walking a guide as an interactive wizard is ITUN's job (`DowntimeWizard`),
 * and belongs to the surfaces that own player state (ADR-021).
 */
export function GuideSteps({
  steps,
  prose,
  sectionAs,
  depth,
  isDown,
  compact,
  collapsibleTables,
  chassisName,
  NestedCard,
}: {
  steps: ResolvedGuideStep[]
  prose: CardProseContext
  sectionAs: ElementType | undefined
  /** The HOST card's depth — step entities render one level below it. */
  depth: number
  isDown: boolean
  compact: boolean
  /** A catalog tile or nested card gets its tables collapsible. */
  collapsibleTables: boolean
  chassisName: string | undefined
  NestedCard: NestedCard
}) {
  return (
    <div className="flex flex-col gap-3">
      {steps.map(({ step, number, section, entities, table, subGuide }) => {
        // `sidebar` marks a step whose entities are a progression LADDER
        // (crawler tech levels) rather than a set of options — they read down
        // a narrow column beside the prose instead of across a masonry.
        const sidebar = step.entityLayout === 'sidebar' && entities.length > 0
        const stepProse = step.content && step.content.length > 0 && (
          <CardProse body={step.content} context={prose} />
        )
        const cards = entities.map((option, index) => (
          <NestedCard
            key={cardKey(option, index)}
            size="medium"
            extent="head"
            depth={depth + 1}
            hostDown={isDown}
            data={option}
            chassisName={chassisName}
          />
        ))
        return (
          <div key={step.id} className="flex flex-col gap-1.5">
            {section && <Slab variant="solid" label={section} as={sectionAs} />}
            {/* Steps nest under a `section` band when there is one (h2 -> h3). */}
            <Slab
              variant="dashed"
              label={`${number}. ${step.name}`}
              as={sectionAs && section ? 'h3' : sectionAs}
              count={step.optional ? 'Optional' : undefined}
            />
            {sidebar ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="flex shrink-0 flex-col gap-1.5 md:w-2/5">{cards}</div>
                <div className="min-w-0 flex-1">{stepProse}</div>
              </div>
            ) : (
              <>
                {stepProse}
                {cards.length > 0 && (
                  <div className="columns-1 gap-1.5 sm:columns-2">
                    {entities.map((option, index) => (
                      <div key={cardKey(option, index)} className="mb-1.5 break-inside-avoid">
                        {cards[index]}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {table && (
              <RollTable
                table={table.table}
                tableName={table.name}
                showCommand
                size={compact ? 'compact' : 'full'}
                collapsible={collapsibleTables}
                disabled={isDown}
              />
            )}
            {subGuide && (
              <NestedCard
                size="medium"
                extent="head"
                depth={depth + 1}
                hostDown={isDown}
                data={subGuide}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
