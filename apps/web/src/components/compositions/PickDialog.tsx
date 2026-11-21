import type { CSSProperties, ReactNode } from 'react'
import { color, space } from '../../design/tokens'
import { compositionsCopy } from '../../messages/components-compositions'
import { Button } from '../atoms/Button'
import { FieldError } from '../atoms/FieldError'
import { Text } from '../atoms/Text'
import { DialogActions } from '../containers/DialogActions'
import { EmptyState } from '../containers/EmptyState'
import { ModalShell } from '../containers/ModalShell'
import { Pending } from '../containers/Pending'
import { RadioCardGroup } from '../containers/RadioCardGroup'
import { SlabSection } from '../containers/SlabSection'
import type { TagItem } from '../entity'
import { Entity } from '../entity/Entity'
import type { LinkedUnit } from '../entity/LinkedUnits'
import type { EntityFormModel } from '../entity/types'

/** One thing on offer: its Compact, and what the Compact carries beside its name. */
type PickChoice = {
  /** The radio value, unique across every group. */
  id: string
  model: EntityFormModel
  /** The Compact's accessible name. */
  label: string
  /** The host's labels right of the name (who holds it). */
  labels?: ReactNode
  /** What the move or link would touch (`GAME | Rust Belt`), as relation chips (C11). */
  relations?: TagItem[]
  /** The units it is linked to, header-only Minis leading its body (`<Entity linked>`). */
  linked?: readonly LinkedUnit[]
}

/** A run of choices; with a `title` it stands under its Slab (Pilots, Mechs). */
export type PickGroup = {
  key: string
  title?: string
  choices: readonly PickChoice[]
}

type PickDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** The dialog's accessible description. */
  description?: string
  /** What is on offer; undefined while it loads. An empty group is left out. */
  groups: readonly PickGroup[] | undefined
  /** What is loading, for `Pending` ("your Training Bay"). */
  loading?: string
  /** What it says when nothing is on offer (chrome K8). */
  empty: string
  /** The picked choice's id, or null. */
  selected: string | null
  onSelect: (id: string) => void
  /**
   * Several at once: the picked ids. Each Compact is then a toggle (its own
   * checkbox, EDL Modes) and `onSelect` flips one; `selected` is not read.
   */
  many?: readonly string[]
  /** Ways on from here, under the choices or the empty state (a link to build one). */
  doors?: ReactNode
  /** A line under the choices: what picking does (a move, a reassignment). */
  note?: ReactNode
  /** A refusal, said where the player is still looking. */
  error?: string | null
  /** The primary button's words. */
  confirmLabel: string
  confirmAria?: string
  /** What confirming does; absent, the primary button is off (nothing picked yet). */
  confirm?: () => void
  /** A confirm in flight: both buttons rest. */
  pending?: boolean
}

const BODY = {
  backgroundColor: color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  padding: space[20],
} satisfies CSSProperties

/** The groups, one radio group: 16px between them. */
const GROUPS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties

/** The ways on, in a row that wraps. */
const DOORS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties

/** One group: its Slab, then its Compacts 8px apart. */
const GROUP = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

/** The choices' group: one radio group, or a labelled group of toggles for a pick of several. */
function Choices({ label, many, children }: { label: string; many: boolean; children: ReactNode }) {
  if (!many) {
    return (
      <RadioCardGroup label={label} style={GROUPS}>
        {children}
      </RadioCardGroup>
    )
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset's legend would repeat the dialog's title above the Slabs
    <div role="group" aria-label={label} style={GROUPS}>
      {children}
    </div>
  )
}

/**
 * PickDialog — the one pick dialog (ruleset §6.6): a narrow `ModalShell`
 * (chrome K7) around one radio group of Compacts in select mode (EDL "Modes":
 * ink ring and the "Selected" seal), each run of them under its Slab, then
 * Cancel and the primary act in `DialogActions`. With `many` the Compacts are
 * toggles in a labelled group, for a pick of several at once. Nothing on offer is one
 * `EmptyState` (K8). Assigning a unit to a slot, moving one in from the
 * Training Bay and choosing the pilot to play are each this dialog with their own
 * choices and act.
 */
export function PickDialog({
  open,
  onOpenChange,
  title,
  description,
  groups,
  loading = compositionsCopy('theChoices'),
  empty,
  selected,
  onSelect,
  many,
  doors,
  note,
  error,
  confirmLabel,
  confirmAria,
  confirm,
  pending = false,
}: PickDialogProps) {
  const shown = groups?.filter((group) => group.choices.length > 0) ?? []
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width="narrow"
    >
      <div style={BODY}>
        {groups === undefined ? (
          <Pending label={loading} />
        ) : shown.length === 0 ? (
          <EmptyState variant="quiet" body={empty} />
        ) : (
          <Choices label={title} many={many !== undefined}>
            {shown.map((group) => {
              const rows = group.choices.map((choice) => (
                <Entity
                  key={choice.id}
                  size="compact"
                  model={choice.model}
                  mode={{
                    kind: 'select',
                    role: many === undefined ? 'radio' : 'toggle',
                    selected:
                      many === undefined ? choice.id === selected : many.includes(choice.id),
                    onSelect: () => onSelect(choice.id),
                    label: choice.label,
                  }}
                  labels={choice.labels}
                  {...(choice.relations && choice.relations.length > 0
                    ? { relations: choice.relations }
                    : {})}
                  {...(choice.linked?.length ? { linked: choice.linked } : {})}
                />
              ))
              return group.title ? (
                <SlabSection
                  key={group.key}
                  as="h3"
                  title={group.title}
                  aria-label={group.title}
                  bodyStyle={GROUP}
                >
                  {rows}
                </SlabSection>
              ) : (
                <div key={group.key} style={GROUP}>
                  {rows}
                </div>
              )
            })}
          </Choices>
        )}

        {doors && <div style={DOORS}>{doors}</div>}

        {note && <Text variant="note">{note}</Text>}

        {error && <FieldError>{error}</FieldError>}

        <DialogActions>
          <Button
            variant="ghost"
            size="compact"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {compositionsCopy('cancel')}
          </Button>
          <Button
            variant="primary"
            size="compact"
            onClick={confirm}
            disabled={pending || confirm === undefined}
            aria-label={confirmAria}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}
