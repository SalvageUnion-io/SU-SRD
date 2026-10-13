import { Badge, Entity, Slab, Stat } from 'component-lib'
import { Fragment, useMemo } from 'react'
import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import { getEntitySlug, toEntityModel } from 'salvageunion-reference'
import type { AbilityTreeGroup, BranchTree, ClassPath, ClassPlan } from '../lib/classPaths'
import { resolveClassPlan, treeOwner } from '../lib/classPaths'
import { itemHref } from '../lib/entityHref'
import type { RefText } from '../lib/rollTablePage'
import { MentionProse } from './MentionProse'

type ClassAbilityTreeProps = {
  classEntity: SURefClass
}

/** The tree's slab names the kind, so its Rows drop the type stamp. */
const OMIT_KIND = ['kind'] as const
/** On a track the tier numeral sits on the track, outside the banner. */
const OMIT_KIND_TIER = ['kind', 'tier'] as const

/** The Workshop Manual page "Gaining Abilities" sits on: the brief cites it. */
const GAINING_ABILITIES_PAGE = 23

const abilityHref = (ability: SURefAbility) => itemHref('abilities', getEntitySlug(ability))
const classHref = (c: SURefClass) => itemHref('classes', getEntitySlug(c))

/**
 * One ability in its tree: a Row in link mode, a real same-tab link to the
 * ability's page — the listing row's shape (`EntityListingRow`), so a crawler
 * follows it and a reader keeps their back button. Its banner wears its tier
 * (EDL E12: Core brick, Advanced orange, Hybrid rust, Legendary pink), the hue
 * of its track; on a track the Row leaves its numeral to the track.
 */
function AbilityTreeListing({ ability, onTrack }: { ability: SURefAbility; onTrack: boolean }) {
  return (
    <Entity
      form="row"
      entity={ability}
      mode={{ kind: 'link', href: abilityHref(ability) }}
      omit={onTrack ? OMIT_KIND_TIER : OMIT_KIND}
      lead
      titleAs="h3"
    />
  )
}

/**
 * Which track a tree draws (ruleset "Where the screen departs from print": the
 * ability-tree track stays a diagram). Core and Advanced/Hybrid trees are
 * trained in order — each Ability needs the one before it — so their three
 * tiers hang off one thick track in the tier's hue (Core = brick,
 * Advanced = pilot orange, Hybrid = rust), each tier's numeral on it beside its banner. A
 * Legendary tree is a pick-one, not a sequence, so it has none: an "or" stands
 * between its Abilities instead.
 */
type TreeTrack = 'core' | 'advanced' | 'hybrid' | null

/** What a tree's slab notes: "Tree" for a sequence, "Choose 1" for a Legendary tree. */
const noteFor = (track: TreeTrack) => (track ? 'Tree' : 'Choose 1')

/**
 * A tree as Rows on its track, under a slab naming it (and, for a branch, its
 * owner). On the class page the slab is an `h2` and each Ability's title an
 * `h3`, the card's own outline (`sectionHeadingLevel`, `nestedTitleLevel` in
 * component-lib): a screen-reader user jumps tree to tree and Ability to
 * Ability rather than reading a wall of links (WCAG 1.3.1, 2.4.6).
 */
function TreeSection({
  tree,
  abilities,
  track,
  note,
}: AbilityTreeGroup & { track: TreeTrack; note?: string }) {
  return (
    <section className="srd-ability-tree__group">
      <Slab variant="solid" as="h2" label={tree} count={note ?? noteFor(track)} />
      <ol className="srd-ability-tree__track" data-track={track ?? undefined}>
        {abilities.map((ability, index) => {
          const tier = track ? toEntityModel(ability).tier : undefined
          return (
            <li key={ability.id} className="srd-ability-tree__tier">
              {/* A pick-one tree: "or" between its Abilities, never a numbered spine. */}
              {!track && index > 0 && <Or />}
              {tier && (
                // The list's order already says the tier; the numeral is the print's mark.
                <span className="srd-ability-tree__numeral" aria-hidden="true">
                  {tier}
                </span>
              )}
              <AbilityTreeListing ability={ability} onTrack={!!track} />
            </li>
          )
        })}
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
        // The book's verb: "to advance into the Class" (Workshop Manual p.23).
        label: 'Advance',
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

/** "or" between the trees that open a path, a quiet caps label like a lone-label badge. */
function Or({ children = 'or' }: { children?: string }) {
  return <span className="srd-class-path__or">{children}</span>
}

/**
 * What opens a path, as value cells: the class's own path names its tree and
 * that only this class walks it ("REQ | MECH-TECH · ENGINEER ONLY"); a hybrid
 * names the tree this class trains first, then each other tree that also
 * opens it under the class that owns it, that class's cell in paper so it
 * reads at a glance on the pilot band ("REQ | FORGING or HACKER | ELECTRONICS").
 */
function PathRequirement({ path, classEntity }: { path: ClassPath; classEntity: SURefClass }) {
  if (!path.hybrid || !path.via) {
    return (
      <span className="srd-class-path__req">
        <Stat
          orientation="horizontal"
          label="REQ"
          value={path.requirement.join(' or ')}
          size="compact"
        />
        <Or>{`${classEntity.name} only`}</Or>
      </span>
    )
  }
  const others = path.requirement.filter((tree) => tree !== path.via)
  return (
    <span className="srd-class-path__req">
      <Stat orientation="horizontal" label="REQ" value={path.via} size="compact" />
      {others.map((tree) => (
        <Fragment key={tree}>
          <Or />
          <Stat
            orientation="horizontal"
            label={treeOwner(tree)?.name ?? 'Tree'}
            value={tree}
            size="compact"
            bgColor="var(--color-paper)"
            textColor="var(--color-ink)"
          />
        </Fragment>
      ))}
    </span>
  )
}

const articleFor = (name: string) => (/^[AEIOU]/i.test(name) ? 'an' : 'a')

function Chevron() {
  return (
    <svg
      className="srd-class-path__chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

/**
 * One path a Core class advances along (the Workshop Manual's class spread
 * lists them: Advanced Abilities, then the Hybrid Classes), every one in the
 * same card, one column: a pilot head that carries what opens the path and
 * what it is, its name on the paper cut-out at the band's foot (a Row's,
 * EDL Row), then its trees as Rows on their tracks. The class's own Advanced
 * tree is no entity of its own, so its head names where it ends ("Legendary
 * Engineer") and links nowhere; a Hybrid Class's head opens its page.
 */
function PathCard({ path, classEntity }: { path: ClassPath; classEntity: SURefClass }) {
  const hybrid = path.hybrid
  const name = hybrid?.name ?? path.legendary?.tree ?? path.advanced.tree
  const kind = hybrid ? 'Hybrid' : 'Legendary'
  const note = hybrid
    ? toEntityModel(hybrid).lead
    : `Stay ${articleFor(classEntity.name)} ${classEntity.name}: ${path.advanced.tree}, then one ${name} Ability.`
  const head = (
    <>
      <span className="srd-class-path__band">
        <PathRequirement path={path} classEntity={classEntity} />
        <span className="srd-class-path__kind">
          <Badge shape="stamp" size="mini" style={{ flex: 'none' }}>
            {kind}
          </Badge>
          {hybrid && <Chevron />}
        </span>
      </span>
      {note && <span className="srd-class-path__note">{note}</span>}
      <span className="srd-class-path__name">{name}</span>
    </>
  )
  return (
    <li className="srd-class-path" data-kind={kind.toLowerCase()}>
      {hybrid ? (
        <a className="srd-class-path__head" href={classHref(hybrid)}>
          {head}
        </a>
      ) : (
        <div className="srd-class-path__head">{head}</div>
      )}
      <div className="srd-class-path__body">
        <div className="srd-class-path__trees" data-entity-fit="">
          <TreeSection {...path.advanced} track={hybrid ? 'hybrid' : 'advanced'} />
          {path.legendary && <TreeSection {...path.legendary} track={null} />}
        </div>
      </div>
      <div className="srd-class-path__foot">
        <span>Workshop Manual</span>
        <span className="srd-class-path__page">p.{(hybrid ?? classEntity).page}</span>
      </div>
    </li>
  )
}

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
          <div className="srd-ability-tree__row" data-entity-fit="">
            <TreeSection {...path.advanced} track="hybrid" />
            {path.legendary && <TreeSection {...path.legendary} track={null} />}
          </div>
        </section>
        <BranchTrees branches={branches} />
      </div>
    )
  }

  // The class's own path (its Advanced and Legendary trees) sits beside its
  // Core trees; each Hybrid Class it may advance into runs full width below.
  const ownPaths = plan.paths.filter((path) => !path.hybrid)
  const hybridPaths = plan.paths.filter((path) => path.hybrid)
  const pathList = (paths: ClassPath[]) => (
    <ul className="srd-class-paths">
      {paths.map((path) => (
        <PathCard
          key={path.hybrid?.id ?? path.advanced.tree}
          path={path}
          classEntity={classEntity}
        />
      ))}
    </ul>
  )
  return (
    <div className="srd-ability-tree">
      <ClassBrief plan={plan} />
      {(plan.coreTrees.length > 0 || ownPaths.length > 0) && (
        <div className="srd-ability-tree__split">
          {plan.coreTrees.length > 0 && (
            <section className="srd-ability-tree__section">
              <Slab variant="dashed" label="Core trees" />
              <div className="srd-ability-tree__row srd-ability-tree__row--stack">
                {plan.coreTrees.map((group) => (
                  <TreeSection key={group.tree} {...group} track="core" />
                ))}
              </div>
            </section>
          )}
          {ownPaths.length > 0 && (
            <section className="srd-ability-tree__section">
              <Slab variant="dashed" label="Advancement" />
              {pathList(ownPaths)}
            </section>
          )}
        </div>
      )}
      {hybridPaths.length > 0 && (
        <section className="srd-ability-tree__section">
          <Slab variant="dashed" label="Hybrid Classes" />
          {pathList(hybridPaths)}
        </section>
      )}
    </div>
  )
}

/**
 * A Hybrid Class's branches (its spread): the Core trees it may also take
 * Abilities from, each slab naming the class that owns the tree.
 */
function BranchTrees({ branches }: { branches: BranchTree[] }) {
  const groups = branches.flatMap(({ group, owner }) => (group ? [{ group, owner }] : []))
  if (groups.length === 0) return null
  return (
    <section className="srd-ability-tree__section">
      <Slab variant="dashed" label="Branch trees" />
      <div className="srd-ability-tree__row" data-entity-fit="">
        {groups.map(({ group, owner }) => (
          <TreeSection key={group.tree} {...group} track="core" note={owner?.name} />
        ))}
      </div>
    </section>
  )
}
