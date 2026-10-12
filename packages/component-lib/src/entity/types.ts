/**
 * The entity display language's React-side types: which FORM draws an entity
 * and which MODE fills its slots. The model those forms draw is
 * `salvageunion-reference`'s `EntityModel` (`lib/view/`); the agreed language is
 * `docs/design-system/entity-display-language.md`.
 */

import type { HTMLAttributes } from 'react'
import type { EntityModel } from 'salvageunion-reference'

/** The five forms, smallest to largest. Phase 2 draws `token` and `row`. */
export type EntityForm = 'mention' | 'token' | 'row' | 'card' | 'page'

/**
 * Attributes a link surface takes from its host, for a list that owns the
 * semantics (a combobox's `role="option"`, its `id` and `aria-selected`).
 */
export type EntityLinkAttrs = Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'style'>

/**
 * One discriminated value per form (E7): a mode fills the form's reserved
 * slots and never changes its anatomy.
 *
 * - `read`: no affordance.
 * - `link`: the whole surface opens the entity, with a chevron in the head. It
 *   resolves through the surface (`hrefFor`, then `openPage`); `href` or
 *   `onOpen` overrides it for a target the surface cannot name (a search
 *   result's page, ITUN's detail modal until the Page drawer lands).
 * - `select`: the whole surface toggles; an ink ring and a "Selected" seal.
 */
export type EntityMode =
  | { kind: 'read' }
  | { kind: 'link'; href?: string; onOpen?: () => void; attrs?: EntityLinkAttrs }
  | {
      kind: 'select'
      role: 'radio' | 'toggle'
      selected: boolean
      onSelect: () => void
      /** The seal's word: "Selected" unless the picker says otherwise ("Chosen"). */
      seal?: string
    }

/**
 * What a Row or a Token draws: the model's identity, kind, fill, facts,
 * traits, lead and art. A full `EntityModel` is one; so is the slim copy a
 * build-time index carries (the SRD's search index), which has no prose,
 * children or table to ship.
 */
export type EntityRowModel = Pick<
  EntityModel,
  'ref' | 'title' | 'kind' | 'tone' | 'facts' | 'traits' | 'art'
> &
  Partial<
    Pick<
      EntityModel,
      'tier' | 'techLevel' | 'cost' | 'actionType' | 'mechActionType' | 'lead' | 'userMade'
    >
  >

/**
 * A fact the context already states, by key (`tech-level` under a TL slab), or
 * `kind` when a group's slab already names the kind.
 */
export type EntityOmit = string
