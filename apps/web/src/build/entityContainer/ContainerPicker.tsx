/**
 * ContainerPicker — the one control that picks a container: your Training Bay (the
 * shelf) or one of your Games (ADR-030 §2). The host decides which containers
 * are offered (`moveDestinations` for a move, the Games you are in for
 * navigation) and what picking does; the picker only draws them, in the shape
 * its place calls for:
 *
 * - `select` — a faux-select (the sheet's "In:"): the shelf leads, the Games
 *   follow under "Games", then any actions.
 * - `menu` — a `HeaderMenu` dropdown (the masthead's Games).
 * - `list` — a column of Compacts (ruleset §1.9: a Game is a Compact), the whole Compact
 *   the pick (the Move dialog, the mobile drawer); an action is a button.
 *
 * Every variant writes a choice the same way: its label, then its hint after a
 * middle dot (a role). `actions` are entries that act rather than pick
 * ("+ New Game").
 */

import type { Container } from 'game-domain/container'
import type { ChangeEvent, CSSProperties } from 'react'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  EmptyState,
  Entity,
  HeaderMenu,
  loadingCopy,
  Pending,
  Select,
  Stat,
  tokens,
} from '../../components/index'
import { gameRowModel, hangarRowModel } from '../../lib/games/containerRow.model'
import { serializeContainer } from './containerKey.model'

/** One container on offer: what it is called and, optionally, a quieter hint (a role). */
export type ContainerChoice = { container: Container; label: string; hint?: string }

/**
 * An entry that acts rather than picks ("+ New Game"). Its `id` is its
 * option's value, so it is never a container's (`shelf`, `game:…`).
 */
type ContainerPickerAction = { id: string; label: string; onSelect: () => void }

type CommonProps = {
  /** What is on offer; undefined while it loads. */
  choices: readonly ContainerChoice[] | undefined
  onPick: (choice: ContainerChoice) => void
  actions?: readonly ContainerPickerAction[]
}

type SelectVariantProps = CommonProps & {
  variant: 'select'
  /** The container it shows: where the thing is, or what the page shows. */
  value: Container
  id: string
  /** Its accessible name. */
  label: string
  disabled?: boolean
  /** The host's width and height rungs (`.su-container-select`). */
  className?: string
  /** Placement only: its width. */
  style?: CSSProperties
}

type MenuVariantProps = CommonProps & {
  variant: 'menu'
  /** The trigger's text, which also names the menu. */
  trigger: string
  /** The page is one of the choices, so the menu is where you are. */
  active?: boolean
  /** What is loading, for the inert row while the choices load (`loadingCopy`: "your Games"). */
  loading: string
  /** The inert row when there are none. */
  empty: string
}

type ListVariantProps = CommonProps & {
  variant: 'list'
  /** Names the list. */
  label: string
  /** What is loading, for `Pending` ("your Games"). */
  loading: string
  /** What it says when there is nowhere to go. */
  empty: string
}

type ContainerPickerProps = SelectVariantProps | MenuVariantProps | ListVariantProps

/** An action's button spans the list, as the Compacts above it do. */
const LIST_ACTION = { width: '100%' } satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

function PickerSelect({
  choices,
  onPick,
  actions = [],
  value,
  id,
  label,
  disabled,
  className,
  style,
}: SelectVariantProps) {
  const all = choices ?? []
  const shelf = all.filter((c) => c.container.kind === 'shelf')
  const games = all.filter((c) => c.container.kind === 'game')
  // Option values ARE the serialized container; an action's value is its id.
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const raw = e.target.value
    const action = actions.find((a) => a.id === raw)
    if (action) {
      action.onSelect()
      return
    }
    const choice = all.find((c) => serializeContainer(c.container) === raw)
    if (choice) onPick(choice)
  }
  return (
    <Select
      chevron
      id={id}
      aria-label={label}
      value={serializeContainer(value)}
      onChange={handleChange}
      disabled={disabled}
      className={className}
      style={style}
    >
      {shelf.map((c) => (
        <option key={serializeContainer(c.container)} value={serializeContainer(c.container)}>
          {c.label}
        </option>
      ))}
      {games.length > 0 && (
        <optgroup label="Games">
          {games.map((c) => (
            <option key={serializeContainer(c.container)} value={serializeContainer(c.container)}>
              {c.hint ? `${c.label} · ${c.hint}` : c.label}
            </option>
          ))}
        </optgroup>
      )}
      {actions.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label}
        </option>
      ))}
    </Select>
  )
}

function PickerMenu({
  choices,
  onPick,
  actions = [],
  trigger,
  active = false,
  loading,
  empty,
}: MenuVariantProps) {
  // A row without `onSelect` is an inert menuitem, so the loading and empty
  // states stay inside the menu a screen reader is walking.
  const rows: HeaderMenuItem[] =
    choices === undefined
      ? [{ id: 'loading', label: loadingCopy(loading) }]
      : choices.length === 0
        ? [{ id: 'none', label: empty }]
        : choices.map((c) => ({
            id: serializeContainer(c.container),
            label: c.label,
            hint: c.hint,
            onSelect: () => onPick(c),
          }))
  const sections = actions.length > 0 ? [rows, [...actions]] : [rows]
  return <HeaderMenu trigger={trigger} active={active} sections={sections} />
}

function PickerList({ choices, onPick, actions = [], label, loading, empty }: ListVariantProps) {
  if (choices === undefined) return <Pending label={loading} />
  if (choices.length === 0 && actions.length === 0) {
    return <EmptyState variant="inline" body={empty} />
  }
  return (
    <ul aria-label={label} style={LIST}>
      {choices.map((c) => (
        <li key={serializeContainer(c.container)}>
          <Entity
            size="compact"
            model={c.container.kind === 'game' ? gameRowModel(c.label) : hangarRowModel(c.label)}
            mode={{ kind: 'link', onOpen: () => onPick(c) }}
            labels={c.hint ? <Stat label={c.hint} size="compact" /> : undefined}
          />
        </li>
      ))}
      {actions.map((a) => (
        <li key={a.id}>
          <Button variant="ghost" style={LIST_ACTION} onClick={a.onSelect}>
            {a.label}
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function ContainerPicker(props: ContainerPickerProps) {
  if (props.variant === 'select') return <PickerSelect {...props} />
  if (props.variant === 'menu') return <PickerMenu {...props} />
  return <PickerList {...props} />
}
