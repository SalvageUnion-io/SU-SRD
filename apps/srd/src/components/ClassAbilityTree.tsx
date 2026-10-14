import { ActivationCost, Badge, Slab, Stat } from 'component-lib'
import { useMemo } from 'react'
import type { SURefClass } from 'salvageunion-reference'
import { getEntitySlug, toEntityModel } from 'salvageunion-reference'
import type { AbilityTreeGroup, BranchTree, ClassPath, ClassPlan } from '../lib/classPaths'
import { resolveClassPlan } from '../lib/classPaths'
import { itemHref } from '../lib/entityHref'
import type { RefText } from '../lib/rollTablePage'
import type { TreeTrack } from './AbilityTrack'
import { AbilityTrack } from './AbilityTrack'
import { MentionProse } from './MentionProse'

type ClassAbilityTreeProps = {
  classEntity: SURefClass
}

/** The Workshop Manual page "Gaining Abilities" sits on: the brief cites it. */
const GAINING_ABILITIES_PAGE = 23

const classHref = (c: SURefClass) => itemHref('classes', getEntitySlug(c))

/** What a tree's slab notes: "Tree" for a sequence, "Choose 1" for a Legendary tree. */
const noteFor = (track: TreeTrack) => (track === 'legendary' ? 'Choose 1' : 'Tree')

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
      <AbilityTrack abilities={abilities} track={track} titleAs="h3" />
    </section>
  )
}

/** A class named in the brief: a Mention, so it links and Peeks like prose does. */
const classMention = (c: SURefClass): RefText[number] => ({
  text: c.name,
  ref: { schemaName: 'classes', id: c.id, slug: getEntitySlug(c), name: c.name },
})

/**
 * One tier card of the brief: its book hue (the trees' own), what it costs,
 * and what opens it, in one short line.
 */
type BriefCard = { label: string; tier: TreeTrack; cost?: string; value: RefText }

function briefCards(plan: Exclude<ClassPlan, { kind: 'none' }>): BriefCard[] {
  if (plan.kind === 'hybrid') {
    const { path } = plan
    return [
      {
        // The book's verb: "to advance into the Class" (Workshop Manual p.23).
        label: 'Advance',
        tier: 'core',
        value: [`6 Core Abilities and 3 in ${path.requirement.join(' or ')}.`],
      },
      { label: 'Hybrid', tier: 'hybrid', cost: '2', value: ['Each, in tree order.'] },
      {
        label: 'Legendary',
        tier: 'legendary',
        cost: '3',
        value: [`Once you have every ${path.advanced.tree} Ability. Only one.`],
      },
    ]
  }
  if (plan.paths.length === 0) {
    return [
      {
        label: 'Core',
        tier: 'core',
        cost: '1',
        value: ['Each, from any Core tree, in tree order.'],
      },
    ]
  }
  return [
    { label: 'Core', tier: 'core', cost: '1', value: ['Each, in tree order.'] },
    {
      label: 'Advanced',
      tier: 'advanced',
      cost: '2',
      value: [
        'Each, after 6 Core and 3 in the linked tree. Your Advanced tree or one Hybrid Class.',
      ],
    },
    {
      label: 'Legendary',
      tier: 'legendary',
      cost: '3',
      value: ['After 3 Advanced or Hybrid Abilities. Only one.'],
    },
  ]
}

/** A Hybrid Class's trees, with the class that owns each branch. */
function hybridTrees(plan: Extract<ClassPlan, { kind: 'hybrid' }>): RefText {
  const trees: RefText = [`${plan.path.advanced.tree}`]
  for (const branch of plan.branches) {
    trees.push(`, ${branch.tree}`)
    if (branch.owner) trees.push(' (', classMention(branch.owner), ')')
  }
  trees.push(': take Abilities from any of these.')
  return trees
}

/**
 * The class's training brief, from "Gaining Abilities" (Workshop Manual p.23)
 * and its own spread, as tier cards: a dashed slab citing the page with the
 * ability limit at its end, then one card per tier, its band in the tier's
 * book hue (the trees' tracks below wear the same), its name on the paper
 * cut-out and its TP cost in the book's pointy box, its body what opens it.
 * A Hybrid Class lists its trees under the cards. On a wide page it sits
 * beside the art, in the room the short class prose leaves (`pages.css`).
 */
function ClassBrief({ plan }: { plan: Exclude<ClassPlan, { kind: 'none' }> }) {
  return (
    <aside className="srd-class-brief" aria-label="Training">
      <div className="srd-class-brief__head">
        <Slab variant="dashed" label="Training" count={`p.${GAINING_ABILITIES_PAGE}`} />
        <Stat
          orientation="horizontal"
          label="Abilities"
          value={`Up to ${plan.classEntity.maxAbilities}`}
          size="compact"
        />
      </div>
      <ul className="srd-class-brief__cards">
        {briefCards(plan).map((card) => (
          <li key={card.label} className="srd-class-brief__card" data-tier={card.tier}>
            <div className="srd-class-brief__band">
              <span className="srd-class-brief__tab">{card.label}</span>
              {card.cost && <ActivationCost cost={card.cost} currency="TP" compact />}
            </div>
            <p className="srd-class-brief__body">
              <MentionProse parts={card.value} />
            </p>
          </li>
        ))}
      </ul>
      {plan.kind === 'hybrid' && (
        <p className="srd-class-brief__trees">
          <span className="srd-class-brief__trees-label">Trees</span>{' '}
          <MentionProse parts={hybridTrees(plan)} />
        </p>
      )}
    </aside>
  )
}

/** "Engineer only" by the requirement, a quiet caps label like a lone-label badge. */
function Or({ children }: { children: string }) {
  return <span className="srd-class-path__or">{children}</span>
}

/**
 * What opens a path, as one chip: the trees any one of which opens it
 * ("REQ | FORGING or ELECTRONICS"), the tree this class trains first leading.
 * The class's own path adds that only this class walks it ("ENGINEER ONLY").
 */
function PathRequirement({ path, classEntity }: { path: ClassPath; classEntity: SURefClass }) {
  const own = !path.hybrid || !path.via
  const trees = own
    ? path.requirement
    : [path.via, ...path.requirement.filter((tree) => tree !== path.via)]
  return (
    <span className="srd-class-path__req">
      <Stat orientation="horizontal" label="REQ" value={trees.join(' or ')} size="compact" />
      {own && <Or>{`${classEntity.name} only`}</Or>}
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
 * same card, one column: a pilot head with its name on the paper cut-out at
 * the band's foot (a Row's, EDL Row) and, right of the name, what opens the
 * path and its kind; then the body, what the path is over its trees as Rows
 * on their tracks. The class's own Advanced
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
      <span className="srd-class-path__name">{name}</span>
      <span className="srd-class-path__band">
        <PathRequirement path={path} classEntity={classEntity} />
        <Badge shape="stamp" size="mini" style={{ flex: 'none' }}>
          {kind}
        </Badge>
      </span>
      {hybrid && <Chevron />}
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
        {note && <p className="srd-class-path__note">{note}</p>}
        <div className="srd-class-path__trees" data-entity-fit="">
          <TreeSection {...path.advanced} track={hybrid ? 'hybrid' : 'advanced'} />
          {path.legendary && <TreeSection {...path.legendary} track="legendary" />}
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
            {path.legendary && <TreeSection {...path.legendary} track="legendary" />}
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
      <Slab variant="dashed" label="Required Trees" />
      <div className="srd-ability-tree__row" data-entity-fit="">
        {groups.map(({ group, owner }) => (
          <TreeSection key={group.tree} {...group} track="core" note={owner?.name} />
        ))}
      </div>
    </section>
  )
}
