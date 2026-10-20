import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import { Button } from '../atoms/Button'
import { FieldError } from '../atoms/FieldError'
import { DialogActions } from '../containers/DialogActions'
import { EmptyState } from '../containers/EmptyState'
import { ModalShell } from '../containers/ModalShell'
import { Pending } from '../containers/Pending'
import { RadioCardGroup } from '../containers/RadioCardGroup'
import { SlabSection } from '../containers/SlabSection'
import type { TagItem } from '../entity'
import { Entity } from '../entity/Entity'
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

/** One group: its Slab, then its Compacts 8px apart. */
const GROUP = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

const NOTE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  margin: 0,
} satisfies CSSProperties

/**
 * PickDialog — the one pick dialog (ruleset §6.6): a narrow `ModalShell`
 * (chrome K7) around one radio group of Compacts in select mode (EDL "Modes":
 * ink ring and the "Selected" seal), each run of them under its Slab, then
 * Cancel and the primary act in `DialogActions`. Nothing on offer is one
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
  loading = 'the choices',
  empty,
  selected,
  onSelect,
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
          <RadioCardGroup label={title} style={GROUPS}>
            {shown.map((group) => {
              const rows = group.choices.map((choice) => (
                <Entity
                  key={choice.id}
                  size="compact"
                  model={choice.model}
                  mode={{
                    kind: 'select',
                    role: 'radio',
                    selected: choice.id === selected,
                    onSelect: () => onSelect(choice.id),
                    label: choice.label,
                  }}
                  labels={choice.labels}
                  {...(choice.relations && choice.relations.length > 0
                    ? { relations: choice.relations }
                    : {})}
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
          </RadioCardGroup>
        )}

        {note && <p style={NOTE}>{note}</p>}

        {error && <FieldError>{error}</FieldError>}

        <DialogActions>
          <Button
            variant="ghost"
            size="compact"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
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
