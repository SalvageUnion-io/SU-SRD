import { useMemo } from 'react'
import type { RefClass } from 'salvageunion-reference'
import { getEntitySlug, toEntityModel } from 'salvageunion-reference'
import type { AbilityTreeGroup, BranchTree, ClassPath, ClassPlan } from '../lib/classPaths'
import { resolveClassPlan } from '../lib/classPaths'
import { cn } from '../lib/cn'
import { itemHref } from '../lib/entityHref'
import type { RefText } from '../lib/rollTablePage'
import { capsLabel } from './atoms/capsLabel'
import { Box } from './containers/Box'
import type { TreeTrack } from './index'
import { Chips, Head, Slab, SlabSection, Stat, TitledBox } from './index'
import { MentionProse } from './MentionProse'
import { ReferenceAbilityTrack } from './ReferenceAbilityTrack'

const TREES_LABEL = cn('su-class-brief__trees-label', capsLabel({ tracking: 'snug' }))

type ClassAbilityTreeProps = {
  classEntity: RefClass
}

/** The Workshop Manual page "Gaining Abilities" sits on: the brief cites it. */
const GAINING_ABILITIES_PAGE = 23

const classHref = (c: RefClass) => itemHref('classes', getEntitySlug(c))

/** What a tree's slab notes: "Tree" for a sequence, "Choose 1" for a Legendary tree. */
const noteFor = (track: TreeTrack) => (track === 'legendary' ? 'Choose 1' : 'Tree')

/**
 * A tree on its track, under a slab naming it (and, for a branch, its owner).
 * On the class page the slab is an `h2`, the card's own outline
 * (`sectionHeadingLevel`, `nestedTitleLevel` in src/components): a
 * screen-reader user jumps tree to tree rather than reading a wall of links
 * (WCAG 1.3.1, 2.4.6). At level 1 each Ability is a Compact titled with an `h3`;
 * inside a path card (`size="mini"`, level 2: N1) a contentful Mini, whose
 * pill holds no heading.
 */
function TreeSection({
  tree,
  abilities,
  track,
  note,
  size = 'compact',
}: AbilityTreeGroup & { track: TreeTrack; note?: string; size?: 'compact' | 'mini' }) {
  return (
    <SlabSection
      as="h2"
      title={tree}
      count={note ?? noteFor(track)}
      page
      className="su-ability-tree__group"
      bodyClassName="su-ability-tree__track"
    >
      <ReferenceAbilityTrack
        abilities={abilities}
        track={track}
        size={size}
        {...(size === 'compact' ? { titleAs: 'h3' as const } : {})}
      />
    </SlabSection>
  )
}

/** A class named in the brief: a Mention, so it links and Peeks like prose does. */
const classMention = (c: RefClass): RefText[number] => ({
  text: c.name,
  ref: { schemaName: 'classes', id: c.id, slug: getEntitySlug(c), name: c.name },
})

/**
 * One tier card of the brief: its book hue (the trees' own), what it costs,
 * and what opens it, in the Workshop Manual's own words ("Gaining
 * Abilities", p.23).
 */
type BriefCard = { label: string; tier: TreeTrack; cost?: string; value: RefText }

/** The Workshop Manual's rule for each tier, verbatim (p.23). */
const BOOK = {
  core: 'You must have the preceding skill in a Core Ability Tree to train the next Ability.',
  advance:
    'You must have training in 6 Core Abilities and 3 Abilities in the Core Ability tree linked to your Advanced or Hybrid Class to advance into the Class.',
  advanced:
    'You must have the preceding Ability in the Advanced or Hybrid Ability Tree before you train the next Ability.',
  legendary:
    'You must have 6 Core Abilities and 3 Advanced or Hybrid Class Abilities trained before you train a Legendary Ability. You may only have one Legendary Ability.',
} as const

function briefCards(plan: Exclude<ClassPlan, { kind: 'none' }>): BriefCard[] {
  const legendary: BriefCard = {
    label: 'Legendary',
    tier: 'legendary',
    cost: '3',
    value: [BOOK.legendary],
  }
  if (plan.kind === 'hybrid') {
    return [
      // The book's verb: "to advance into the Class".
      { label: 'Advance', tier: 'core', value: [BOOK.advance] },
      { label: 'Hybrid', tier: 'hybrid', cost: '2', value: [BOOK.advanced] },
      legendary,
    ]
  }
  const core: BriefCard = { label: 'Core', tier: 'core', cost: '1', value: [BOOK.core] }
  if (plan.paths.length === 0) return [core]
  return [
    core,
    {
      label: 'Advanced',
      tier: 'advanced',
      cost: '2',
      value: [`${BOOK.advance} ${BOOK.advanced}`],
    },
    legendary,
  ]
}

/** A tier's book hue (§3.8): the band its brief card and its trees' tracks wear. */
const TIER_BAND: Record<TreeTrack, string> = {
  core: 'var(--color-pilot)',
  advanced: 'var(--color-tier-hybrid)',
  hybrid: 'var(--color-tier-hybrid)',
  legendary: 'var(--color-crawler-band)',
}

/** A cut-out head's paint in a tier's hue: the name sits on the paper tab in ink. */
const tierPaint = (tier: TreeTrack) =>
  ({
    background: TIER_BAND[tier],
    color: 'var(--color-ink)',
    ink: false,
    nameOnPaper: false,
  }) as const

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
 * and its own spread, as tier cards: a Slab citing the page with the
 * ability limit at its end, then one card per tier, its band in the tier's
 * book hue (the trees' tracks below wear the same), its name on the paper
 * cut-out and its TP cost in the book's pointy box, its body what opens it.
 * A Hybrid Class lists its trees under the cards. On a wide page it sits
 * beside the art, in the room the short class prose leaves (`pages.css`).
 */
function ClassBrief({ plan }: { plan: Exclude<ClassPlan, { kind: 'none' }> }) {
  return (
    <aside className="su-class-brief" aria-label="Training">
      {/* The limit rides the slab's own row, centred on its label and rule. */}
      <Slab
        label="Training"
        count={`p.${GAINING_ABILITIES_PAGE}`}
        flush
        actions={
          <Stat label="Abilities" value={`Up to ${plan.classEntity.maxAbilities}`} size="compact" />
        }
      />
      <ul className="su-class-brief__cards">
        {briefCards(plan).map((card) => (
          <li key={card.label} className="su-class-brief__card">
            <TitledBox
              title={card.label}
              paint={tierPaint(card.tier)}
              chips={
                card.cost && (
                  <Chips
                    size="compact"
                    chips={{ durations: [], facts: [], tags: [], cost: `${card.cost} TP` }}
                  />
                )
              }
            >
              <p className="su-class-brief__body">
                <MentionProse parts={card.value} />
              </p>
            </TitledBox>
          </li>
        ))}
      </ul>
      {plan.kind === 'hybrid' && (
        <p className="su-class-brief__trees">
          <span className={TREES_LABEL}>Trees</span> <MentionProse parts={hybridTrees(plan)} />
        </p>
      )}
    </aside>
  )
}

/**
 * What opens a path, as one continuous chip: REQ, then the trees any one of
 * which opens it, each "or" an ink label cell between them ("REQ | FORGING |
 * OR | ELECTRONICS"), the tree this class trains first leading. The class's
 * own path adds that only this class walks it ("ENGINEER ONLY"), the same
 * lone-label chip as the path's kind beside it. Its chips are the head's own
 * chips, one line with the kind under the head's chip rules (E17).
 */
function PathRequirement({ path }: { path: ClassPath }) {
  const own = !path.hybrid || !path.via
  const trees = own
    ? path.requirement
    : [path.via, ...path.requirement.filter((tree) => tree !== path.via)]
  return (
    // One chip (`su-chip-link`): its cells butt into one rounded cell.
    <span className="su-chip-link su-class-path__req-chip">
      {trees.map((tree, index) => (
        <Stat
          key={tree}
          label={index === 0 ? 'REQ' : 'or'}
          value={tree}
          size="compact"
          className="su-class-path__req-cell"
        />
      ))}
    </span>
  )
}

const articleFor = (name: string) => (/^[AEIOU]/i.test(name) ? 'an' : 'a')

/**
 * One path a Core class advances along (the Workshop Manual's class spread
 * lists them: Advanced Abilities, then the Hybrid Classes), every one in the
 * same card, one column: a pilot head with its name on the paper cut-out at
 * the band's foot (a Compact's, EDL Compact) and, right of the name, what opens the
 * path and its kind; then the body, what the path is over its trees on their
 * tracks, each Ability a contentful Mini (level 2 in this level-1 card: N1,
 * N3). The class's own Advanced
 * tree is no entity of its own, so its head names where it ends ("Legendary
 * Engineer") and links nowhere; a Hybrid Class's head opens its page.
 */
function PathCard({ path, classEntity }: { path: ClassPath; classEntity: RefClass }) {
  const hybrid = path.hybrid
  const name = hybrid?.name ?? path.legendary?.tree ?? path.advanced.tree
  const kind = hybrid ? 'Hybrid' : 'Legendary'
  const note = hybrid
    ? toEntityModel(hybrid).lead
    : `Stay ${articleFor(classEntity.name)} ${classEntity.name}: ${path.advanced.tree}, then one ${name} Ability.`
  // A Hybrid Class's path wears its rust, the class's own its orange (owner, round 5).
  const track: TreeTrack = hybrid ? 'hybrid' : 'core'
  const head = (
    <Head
      title={name}
      paint={tierPaint(track)}
      chips={
        // The kind and whose it is are marks; what it opens from, its relation (C2).
        // The paths are one list of Compacts (Compact frames, one width): its lines
        // share every class's lane (C6, R2).
        <Chips
          size="compact"
          chips={{ durations: [], facts: [], tags: [] }}
          marks={[
            <Stat key="kind" label={kind} size="compact" />,
            ...(path.hybrid && path.via
              ? []
              : [<Stat key="only" label={`${classEntity.name} only`} size="compact" />]),
          ]}
          nodes={{ relation: <PathRequirement path={path} /> }}
        />
      }
      notch
      chipsBeside
    />
  )
  return (
    <li className="su-class-path" data-kind={kind.toLowerCase()}>
      {/* The Compact's frame (`Box`, standing in `CompactFrame`) under the Compact's
          `Head`: drawn through the forms (EDL E15), never a frame of its own.
          Flush, so the foot's rule spans the frame. */}
      <Box
        body="flush"
        head={
          hybrid ? (
            <a className="su-class-path__link" href={classHref(hybrid)}>
              {head}
            </a>
          ) : (
            head
          )
        }
      >
        <div className="su-class-path__body">
          {note && <p className="su-class-path__note">{note}</p>}
          <div className="su-class-path__trees" data-entity-fit="">
            <TreeSection {...path.advanced} track={hybrid ? 'hybrid' : 'advanced'} size="mini" />
            {path.legendary && <TreeSection {...path.legendary} track="legendary" size="mini" />}
          </div>
        </div>
        {/* The foot shares the head's colour, its citation on a paper cut-out,
            as a page's foot band does (owner, round 5); text, never chips (EDL E9). */}
        <p className="su-class-path__foot" style={{ backgroundColor: TIER_BAND[track] }}>
          <span className="su-class-path__cite">
            Workshop Manual · p.{(hybrid ?? classEntity).page}
          </span>
        </p>
      </Box>
    </li>
  )
}

export function ClassAbilityTree({ classEntity }: ClassAbilityTreeProps) {
  const plan = useMemo(() => resolveClassPlan(classEntity), [classEntity])
  if (plan.kind === 'none') return null

  if (plan.kind === 'hybrid') {
    const { path, branches } = plan
    return (
      <div className="su-ability-tree">
        <ClassBrief plan={plan} />
        <SlabSection title="Abilities" page>
          <div className="su-class-path__trees" data-entity-fit="">
            <TreeSection {...path.advanced} track="hybrid" />
            {path.legendary && <TreeSection {...path.legendary} track="legendary" />}
          </div>
        </SlabSection>
        <BranchTrees branches={branches} />
      </div>
    )
  }

  // The Core trees two across (owner, round 4: "two columns of trees"), on
  // the path cards' shared rows; then every path the class
  // advances along, its own (Legendary) first, then each Hybrid Class, all
  // the same card with their trees side by side.
  return (
    <div className="su-ability-tree">
      <ClassBrief plan={plan} />
      {plan.coreTrees.length > 0 && (
        <SlabSection title="Core trees" page>
          <div className="su-class-path__trees su-class-path__trees--pair" data-entity-fit="">
            {plan.coreTrees.map((group) => (
              <TreeSection key={group.tree} {...group} track="core" />
            ))}
          </div>
        </SlabSection>
      )}
      {plan.paths.length > 0 && (
        <SlabSection title="Advancement" page>
          <ul className="su-class-paths">
            {[...plan.paths]
              .sort((a, b) => Number(Boolean(a.hybrid)) - Number(Boolean(b.hybrid)))
              .map((path) => (
                <PathCard
                  key={path.hybrid?.id ?? path.advanced.tree}
                  path={path}
                  classEntity={classEntity}
                />
              ))}
          </ul>
        </SlabSection>
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
    <SlabSection title="Required Trees" page>
      <div className="su-ability-tree__row" data-entity-fit="">
        {groups.map(({ group, owner }) => (
          <TreeSection key={group.tree} {...group} track="core" note={owner?.name} />
        ))}
      </div>
    </SlabSection>
  )
}
