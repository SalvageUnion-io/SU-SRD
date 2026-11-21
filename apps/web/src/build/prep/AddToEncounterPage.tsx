/**
 * /encounters/add?from=<schema>:<slug> — a Reference denizen's "Add to an
 * encounter" (ADR-067 §3): the reader picks one of their encounters, or starts
 * a new one with it, and lands on that encounter with the denizen fielded.
 */

import type { CSSProperties } from 'react'
import { Button, Callout, Text, TitledBox, toast } from '../../components/index'
import { FullPageShell, NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { useGo } from '../../components/shared/useGo'
import { space } from '../../design/tokens'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { denizenTemplate, isDenizenKind } from '../../lib/npcs/npcModel'
import { runWrite } from '../../lib/runWrite'
import { buildPrepCopy } from '../../messages/build-prep'
import { KIT_PATH } from '../../play/games/prep/gamePrep.model'
import { useEncounters } from '../../replica/collections'
import { useSync } from '../../replica/syncContext'
import { blankEncounter, encounterHref, hasRoomFor, oppositionWith } from './encounter.model'

const PANEL = { maxWidth: '36rem', width: '100%' } satisfies CSSProperties
const BODY = {
  alignItems: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
} satisfies CSSProperties
const ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: space[12],
  justifyContent: 'space-between',
} satisfies CSSProperties

export function AddToEncounterPage({ schema, slug }: { schema: string; slug: string }) {
  const { canWrite } = useSync()
  const go = useGo()
  const hydrated = useHydrateOnMount(() => useEncounters.getState().hydrate())
  const encounters = useEncounters((s) => s.encounters)
  const entity = isDenizenKind(schema) ? denizenTemplate({ schema, slug }) : null

  if (entity === null || !isDenizenKind(schema)) {
    return (
      <NotFoundPanel
        title={buildPrepCopy('notADenizen')}
        message={buildPrepCopy('notADenizenBody')}
        back={{ href: KIT_PATH, label: buildPrepCopy('mediatorsKit') }}
      />
    )
  }

  /** Field it in `encounterId`, or in a new encounter, then open that encounter. */
  async function addTo(encounterId: string | null) {
    if (entity === null || !isDenizenKind(schema)) return
    const store = useEncounters.getState()
    const target =
      encounterId === null
        ? await store.create(blankEncounter())
        : store.encounters.find((e) => e.id === encounterId)
    if (target === undefined) return
    const opposition = oppositionWith(
      target,
      schema,
      entity as never,
      crypto.randomUUID(),
      new Date().toISOString()
    )
    if (opposition === null) return
    await store.update(target.id, { opposition })
    toast.success(buildPrepCopy('addedTo', { name: entity.name, encounter: target.name }))
    go(encounterHref(target.id))
  }

  return (
    <FullPageShell>
      <div style={PANEL}>
        <TitledBox
          title={buildPrepCopy('addNameToAnEncounter', { name: entity.name })}
          titleAs="h1"
          bodyStyle={BODY}
        >
          {!canWrite ? (
            <Callout role="note">
              <Text>{buildPrepCopy('signInToPrepare')}</Text>
            </Callout>
          ) : (
            <>
              <Text variant="note">
                {hydrated && encounters.length === 0
                  ? buildPrepCopy('noEncountersToAddTo')
                  : buildPrepCopy('pickAnEncounter')}
              </Text>
              {encounters.map((encounter) => (
                <div key={encounter.id} style={ROW}>
                  <Text>{encounter.name}</Text>
                  <Button
                    size="compact"
                    variant="default"
                    disabled={!hasRoomFor(encounter)}
                    aria-label={`${buildPrepCopy('add')} ${entity.name}: ${encounter.name}`}
                    onClick={() => runWrite(() => addTo(encounter.id))}
                  >
                    {hasRoomFor(encounter)
                      ? buildPrepCopy('add')
                      : buildPrepCopy('encounterIsFull')}
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  size="compact"
                  variant="primary"
                  onClick={() => runWrite(() => addTo(null))}
                >
                  {buildPrepCopy('inANewEncounter')}
                </Button>
              </div>
            </>
          )}
        </TitledBox>
      </div>
    </FullPageShell>
  )
}
