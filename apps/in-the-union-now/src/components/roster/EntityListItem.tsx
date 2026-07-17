/**
 * EntityListItem — single saved-build row in a roster entity column.
 *
 * Styled as a compact translation of the shared entity card (suref-react
 * `DisplayCard`): a colour-coded left accent rail in the entity's deep sheet
 * tone, a faint type wash behind the row, a black pseudoheader name (the card's
 * signature condensed-uppercase title), and a hover-lift card frame — so a
 * roster row reads as a sibling of the reference cards rather than a plain
 * list item. Type colour: pilot → orange, mech → green, crawler → pink,
 * matching the `--color-sheet-*` theme tokens.
 *
 * Name + muted meta caption (cross-links encoded as '↳ Name' sheet links) +
 * trailing View / Delete actions.
 *
 * Links render through AppLink (TanStack <Link> with a plain-anchor fallback)
 * so the component works in tests without a RouterProvider.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Btn, btnVariants } from 'suref-react'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

type EntityType = 'pilot' | 'mech' | 'crawler'

type EntityListItemProps = {
  id: string
  name: string
  sheetHref: string
  onDeleteClick: (id: string, name: string) => void
  /**
   * Entity type driving the row's colour coding (accent rail + type wash).
   * pilot → su-orange, mech → su-green, crawler → su-pink. Omit to render a
   * neutral (uncoloured) row.
   */
  entityType?: EntityType
  /**
   * Optional secondary line under the name (design row__meta), e.g.
   * `"Wrench" · Engineer · ↳ Iron Fist` for a pilot — '↳ Name' segments are
   * links to the target entity's sheet, so this accepts nodes, not just text.
   */
  meta?: ReactNode
}

/**
 * Per-type sheet tones (see `--color-sheet-*` in suref-react theme.css).
 * `deep` drives the accent rail; `wash` is a faint tint of the base tone mixed
 * into paper so the whole row is legibly coloured by type without fighting the
 * ink text / pseudoheader name.
 */
const SHEET_TONE: Record<EntityType, { rail: string; wash: string }> = {
  pilot: {
    rail: 'var(--color-sheet-pilot-deep)',
    wash: 'color-mix(in srgb, var(--color-sheet-pilot) 10%, var(--color-su-paper))',
  },
  mech: {
    rail: 'var(--color-sheet-mech-deep)',
    wash: 'color-mix(in srgb, var(--color-sheet-mech) 12%, var(--color-su-paper))',
  },
  crawler: {
    rail: 'var(--color-sheet-crawler-deep)',
    wash: 'color-mix(in srgb, var(--color-sheet-crawler) 11%, var(--color-su-paper))',
  },
}

export function EntityListItem({
  id,
  name,
  sheetHref,
  onDeleteClick,
  entityType,
  meta,
}: EntityListItemProps) {
  const tone = entityType ? SHEET_TONE[entityType] : null
  const frameStyle: CSSProperties = tone ? { background: tone.wash } : {}

  return (
    <li className="list-none">
      <div
        className={cn(
          'group relative flex items-stretch overflow-hidden rounded-[3px] border-2 border-ink',
          'shadow-[0_1px_0_rgba(40,32,25,0.05)] transition-all duration-200',
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_7px_18px_rgba(40,32,25,0.16)]',
          !tone && 'bg-paper'
        )}
        style={frameStyle}
      >
        {/* Deep-tone accent rail — the entity card's left body accent, in row form */}
        {tone && (
          <span
            aria-hidden="true"
            className="w-[6px] shrink-0 self-stretch"
            style={{ background: tone.rail }}
          />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            {/* Black pseudoheader name — mirrors the reference card's title box */}
            <span className="inline-block max-w-full truncate align-middle rounded-[1px] bg-ink px-1.5 py-0.5 font-cond text-[15px] font-bold uppercase leading-tight tracking-[0.02em] text-paper">
              {name}
            </span>
            {meta && <div className="mt-1.5 truncate font-body text-xs text-wk-muted">{meta}</div>}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <AppLink
              href={sheetHref}
              className={cn(btnVariants({ variant: 'default', size: 'sm' }), 'no-underline')}
            >
              View
            </AppLink>
            <Btn
              variant="ghost"
              size="sm"
              aria-label={`Delete ${name}`}
              onClick={() => onDeleteClick(id, name)}
              className="px-2 text-danger hover:text-danger"
            >
              <Trash2 aria-hidden="true" />
            </Btn>
          </div>
        </div>
      </div>
    </li>
  )
}
