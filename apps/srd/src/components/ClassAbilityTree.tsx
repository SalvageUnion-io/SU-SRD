import { Entity, Slab, Stat } from 'component-lib'
import { useMemo } from 'react'
import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import type { AbilityTreeGroup, BranchTree, ClassPath, ClassPlan } from '../lib/classPaths'
import { resolveClassPlan } from '../lib/classPaths'
import { itemHref } from '../lib/entityHref'
import type { RefText } from '../lib/rollTablePage'
import { MentionProse } from './MentionProse'

type ClassAbilityTreeProps = {
  classEntity: SURefClass
}

/** The tree's slab names the kind, so its Rows drop the seam stamp. */
const OMIT_KIND = ['kind'] as const

/** A path's tray names the tree that opens it from this class, so its Row drops the full requirement. */
const OMIT_REQUIREMENT = ['class-requires'] as const

/** The Workshop Manual page "Gaining Abilities" sits on: the brief cites it. */
const GAINING_ABILITIES_PAGE = 23

const abilityHref = (ability: SURefAbility) => itemHref('abilities', getEntitySlug(ability))
const classHref = (c: SURefClass) => itemHref('classes', getEntitySlug(c))

/**
 * One ability in its tree: a Row in link mode, a real same-tab link to the
 * ability's page — the listing row's shape (`EntityListingRow`), so a crawler
 * follows it and a reader keeps their back button.
 */
function AbilityTreeListing({ ability }: { ability: SURefAbility }) {
  return (
    <Entity
      form="row"
      entity={ability}
      mode={{ kind: 'link', href: abilityHref(ability) }}
      omit={OMIT_KIND}
    />
  )
}

/**
 * Which track a tree draws (ruleset "Where the screen departs from print": the
 * ability-tree track stays a diagram). Core and Advanced/Hybrid trees are
 * trained in order — each Ability needs the one before it — so their three
 * tiers hang off one connected pipe in the tier's hue (Core = brick, Advanced
 * = pilot). A Legendary tree is a pick-one, not a sequence, so it has none.
 */
type TreeTrack = 'core' | 'advanced' | null

/** What a tree's slab counts: "Tree" for a sequence, "Choose 1" for a Legendary tree. */
const countFor = (track: TreeTrack) => (track ? 'Tree' : 'Choose 1')

/** A tree the page is about: its abilities as Rows (the class's own trees). */
function TreeSection({ tree, abilities, track }: AbilityTreeGroup & { track: TreeTrack }) {
  return (
    <section className="srd-ability-tree__group">
      <Slab variant="solid" label={tree} count={countFor(track)} />
      <ol className="srd-ability-tree__track" data-track={track ?? undefined}>
        {abilities.map((ability) => (
          <li key={ability.id} className="srd-ability-tree__tier">
            <AbilityTreeListing ability={ability} />
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * A tree nested in something else (a path card, a branch): its abilities as
 * Tokens on the same track, the slab counting it, or naming who owns it.
 */
function TokenTree({
  tree,
  abilities,
  track,
  count,
}: AbilityTreeGroup & { track: TreeTrack; count?: string }) {
  return (
    <section className="srd-ability-tree__group" data-form="token">
      <Slab variant="solid" label={tree} count={count ?? countFor(track)} />
      <ol className="srd-ability-tree__track" data-track={track ?? undefined}>
        {abilities.map((ability) => (
          <li key={ability.id} className="srd-ability-tree__tier">
            <Entity
              form="token"
              entity={ability}
              mode={{ kind: 'link', href: abilityHref(ability) }}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

/** A class named in the brief: a Mention, so it links and Peeks like prose does. */
const classMention = (c: SURefClass): RefText[number] => ({
  text: c.name,
  ref: { schemaName: 'classes', id: c.id, slug: getEntitySlug(c), name: c.name },
})

type BriefRow = { label: string; value: RefText }

function briefRows(plan: Exclude<ClassPlan, { kind: 'none' }>): BriefRow[] {
  const max = plan.classEntity.maxAbilities
  const limit: BriefRow = { label: 'Abilities', value: [`Up to ${max}.`] }
  if (plan.kind === 'hybrid') {
    const { path, branches } = plan
    const trees: RefText = [`${path.advanced.tree}`]
    for (const branch of branches) {
      trees.push(`, ${branch.tree}`)
      if (branch.owner) trees.push(' (', classMention(branch.owner), ')')
    }
    trees.push(': take Abilities from any of these.')
    return [
      limit,
      { label: 'Trees', value: trees },
      {
        label: 'Entry',
        value: [`6 Core Abilities and 3 in ${path.requirement.join(' or ')}.`],
      },
      { label: 'Hybrid', value: ['2 TP each, in tree order.'] },
      {
        label: 'Legendary',
        value: [`3 TP, once you have every ${path.advanced.tree} Ability. Only one.`],
      },
    ]
  }
  if (plan.paths.length === 0) {
    return [limit, { label: 'Core', value: ['1 TP each, from any Core tree, in tree order.'] }]
  }
  return [
    limit,
    { label: 'Core', value: ['1 TP each, in tree order.'] },
    {
      label: 'Advanced',
      value: [
        '2 TP each, after 6 Core Abilities and 3 in the linked tree: your Advanced Abilities or one Hybrid Class.',
      ],
    },
    { label: 'Legendary', value: ['3 TP, after 3 Advanced or Hybrid Abilities. Only one.'] },
  ]
}

/**
 * The class's training brief, from "Gaining Abilities" (Workshop Manual p.23)
 * and its own spread: what it costs and what opens each tier. On a wide page it
 * sits beside the art, in the room the short class prose leaves (`pages.css`).
 */
function ClassBrief({ plan }: { plan: Exclude<ClassPlan, { kind: 'none' }> }) {
  return (
    <aside className="srd-class-brief" aria-label="Training">
      <div className="srd-class-brief__head">
        <span>Training</span>
        <span className="srd-class-brief__cite">p.{GAINING_ABILITIES_PAGE}</span>
      </div>
      <dl className="srd-class-brief__rows">
        {briefRows(plan).map((row) => (
          <div key={row.label} className="srd-class-brief__row">
            <dt>{row.label}</dt>
            <dd>
              <MentionProse parts={row.value} />
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}

/**
 * A path's trees, in the tray under its head: what opens it from this class
 * (the one Core tree of its requirement this class trains, "Forging"), then
 * the Advanced or Hybrid tree and the Legendary tree, as Tokens.
 */
function PathTray({ path, requirement }: { path: ClassPath; requirement: string }) {
  return (
    <div className="srd-class-path__tray">
      {requirement && (
        <Stat orientation="horizontal" label="REQ" value={requirement} size="compact" />
      )}
      <TokenTree {...path.advanced} track="advanced" />
      {path.legendary && <TokenTree {...path.legendary} track={null} />}
    </div>
  )
}

/**
 * One path a Core class advances along (the Workshop Manual's class spread
 * lists them: Advanced Abilities, then the Hybrid Classes). A Hybrid Class is
 * its listing Row; the class's own Advanced tree is no entity of its own, so
 * it is a head naming where it ends — "Legendary Engineer" — drawn last. The
 * Row's own requirement names every class's tree; the tray names this one's.
 * The paths are a choice the reader is browsing, so the Row keeps its lead (E11).
 */
function PathCard({ path, classEntity }: { path: ClassPath; classEntity: SURefClass }) {
  if (path.hybrid) {
    return (
      <li className="srd-class-path">
        <div className="srd-class-path__head">
          <Entity
            form="row"
            entity={path.hybrid}
            mode={{ kind: 'link', href: classHref(path.hybrid) }}
            omit={OMIT_REQUIREMENT}
            lead
          />
        </div>
        <PathTray path={path} requirement={path.via ?? ''} />
      </li>
    )
  }
  const title = path.legendary?.tree ?? path.advanced.tree
  return (
    <li className="srd-class-path" data-own="">
      <div className="srd-class-path__head srd-class-path__own">
        <span className="srd-class-path__seam">Advanced Abilities</span>
        <div className="srd-class-path__name">
          {title}
          <svg
            className="srd-class-path__down"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </div>
        <div className="srd-class-path__body">
          <p className="srd-class-path__note">
            {`Stay ${articleFor(classEntity.name)} ${classEntity.name}: ${path.advanced.tree}, then one ${title} Ability.`}
          </p>
        </div>
      </div>
      <PathTray path={path} requirement={path.requirement.join(' or ')} />
    </li>
  )
}

const articleFor = (name: string) => (/^[AEIOU]/i.test(name) ? 'an' : 'a')

export function ClassAbilityTree({ classEntity }: ClassAbilityTreeProps) {
  const plan = useMemo(() => resolveClassPlan(classEntity), [classEntity])
  if (plan.kind === 'none') return null

  if (plan.kind === 'hybrid') {
    const { path, branches } = plan
    return (
      <div className="srd-ability-tree">
        <ClassBrief plan={plan} />
        <section className="srd-ability-tree__section">
          <Slab variant="dashed" label="Abilities" />
          <div className="srd-ability-tree__row" data-columns="2">
            <TreeSection {...path.advanced} track="advanced" />
            {path.legendary && <TreeSection {...path.legendary} track={null} />}
          </div>
        </section>
        <BranchTrees branches={branches} />
      </div>
    )
  }

  return (
    <div className="srd-ability-tree">
      <ClassBrief plan={plan} />
      {plan.coreTrees.length > 0 && (
        <section className="srd-ability-tree__section">
          <Slab variant="dashed" label="Core trees" count={plan.coreTrees.length} />
          <div className="srd-ability-tree__row" data-columns="3">
            {plan.coreTrees.map((group) => (
              <TreeSection key={group.tree} {...group} track="core" />
            ))}
          </div>
        </section>
      )}
      {plan.paths.length > 0 && (
        <section className="srd-ability-tree__section">
          <Slab variant="dashed" label="Advanced & hybrid classes" count={plan.paths.length} />
          <ul className="srd-class-paths">
            {plan.paths.map((path) => (
              <PathCard
                key={path.hybrid?.id ?? path.advanced.tree}
                path={path}
                classEntity={classEntity}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * A Hybrid Class's branches (its spread): the Core trees it may also take
 * Abilities from, as Tokens, each slab naming the class that owns the tree.
 */
function BranchTrees({ branches }: { branches: BranchTree[] }) {
  const groups = branches.flatMap(({ group, owner }) => (group ? [{ group, owner }] : []))
  if (groups.length === 0) return null
  return (
    <section className="srd-ability-tree__section">
      <Slab variant="dashed" label="Branch trees" count={groups.length} />
      <div className="srd-ability-tree__row" data-columns="2">
        {groups.map(({ group, owner }) => (
          <TokenTree key={group.tree} {...group} track="core" count={owner?.name} />
        ))}
      </div>
    </section>
  )
}
