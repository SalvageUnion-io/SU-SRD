import { useMemo } from 'react'
import type { RefClass } from 'salvageunion-reference'
import { getEntitySlug, toEntityModel } from 'salvageunion-reference'
import { cn } from '../lib/cn'
import { itemHref } from '../lib/entityHref'
import type { RefText } from '../lib/rollTablePage'
import type { AbilityTreeGroup, BranchTree, ClassPath, ClassPlan } from '../lib/rules/classPaths'
import { resolveClassPlan } from '../lib/rules/classPaths'
import { componentsCopy } from '../messages/components'
import { capsLabel } from './atoms/capsLabel'
import { FOCUS_RING } from './atoms/interaction'
import { Box } from './containers/Box'
import { TermChip, TRAINING_POINTS } from './entity'
import { RowDress } from './entity/rowDress'
import type { TreeTrack } from './index'
import { Chips, Head, Slab, SlabSection, Stat, TitledBox } from './index'
import { MentionProse } from './MentionProse'
import { ReferenceAbilityTrack } from './ReferenceAbilityTrack'
import { treeAnchor } from './referenceEntity/card/abilityTreeRelations'

const TREES_LABEL = cn('su-class-brief__trees-label', capsLabel({ tracking: 'snug' }))

type ClassAbilityTreeProps = {
  classEntity: RefClass
}

/** The Workshop Manual page "Gaining Abilities" sits on: the brief cites it. */
const GAINING_ABILITIES_PAGE = 23

const classHref = (c: RefClass) => itemHref('classes', getEntitySlug(c))

/** What a tree's slab notes: nothing for a sequence (MOCK, best revision 6: the head is the tree's name), "Choose 1" for a Legendary tree. */
const noteFor = (track: TreeTrack) => (track === 'legendary' ? 'Choose 1' : undefined)

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
  anchored = size === 'compact',
}: AbilityTreeGroup & {
  track: TreeTrack
  note?: string
  size?: 'compact' | 'mini'
  /** Its heading is where an ability's TREE chip lands (`treeAnchor`): once a page. */
  anchored?: boolean
}) {
  return (
    <SlabSection
      as="h2"
      title={tree}
      {...(anchored ? { id: treeAnchor(tree) } : {})}
      count={note ?? noteFor(track)}
      page
      size="mini"
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
    label: componentsCopy('legendary'),
    tier: 'legendary',
    cost: '3',
    value: [BOOK.legendary],
  }
  if (plan.kind === 'hybrid') {
    return [
      // The book's verb: "to advance into the Class".
      { label: componentsCopy('advance'), tier: 'core', value: [BOOK.advance] },
      { label: componentsCopy('hybrid'), tier: 'hybrid', cost: '2', value: [BOOK.advanced] },
      legendary,
    ]
  }
  const core: BriefCard = {
    label: componentsCopy('core'),
    tier: 'core',
    cost: '1',
    value: [BOOK.core],
  }
  if (plan.paths.length === 0) return [core]
  return [
    core,
    {
      label: componentsCopy('advanced'),
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
    <aside id={TRAINING_ID} className="su-class-brief" aria-label={componentsCopy('training')}>
      {/* The limit rides the slab's own row, centred on its label and rule. */}
      <Slab
        label={componentsCopy('training')}
        count={`p.${GAINING_ABILITIES_PAGE}`}
        flush
        actions={
          <Stat
            label={componentsCopy('abilities')}
            value={`Up to ${plan.classEntity.maxAbilities}`}
            size="compact"
          />
        }
      />
      {/* Under the Training strip the tiers are rows, never a second cut-out. */}
      <ul className="su-class-brief__cards" data-rows="">
        <RowDress.Provider value>
          {briefCards(plan).map((card) => (
            <li key={card.label} className="su-class-brief__card">
              <TitledBox
                title={card.label}
                paint={tierPaint(card.tier)}
                chips={
                  card.cost && (
                    // TP has no glossary entry: its box opens what it means (E27).
                    <TermChip term={TRAINING_POINTS} value={String(card.cost)}>
                      <Chips
                        size="mini"
                        chips={{ durations: [], facts: [], tags: [], cost: `${card.cost} TP` }}
                      />
                    </TermChip>
                  )
                }
              >
                <p className="su-class-brief__body">
                  <MentionProse parts={card.value} />
                </p>
              </TitledBox>
            </li>
          ))}
        </RowDress.Provider>
      </ul>
      {plan.kind === 'hybrid' && (
        <p className="su-class-brief__trees">
          <span className={TREES_LABEL}>{componentsCopy('trees')}</span>{' '}
          <MentionProse parts={hybridTrees(plan)} />
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
          label={index === 0 ? componentsCopy('req') : 'or'}
          value={tree}
          size="mini"
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
  // A Hybrid Class's path wears its rust, the class's own its orange.
  const track: TreeTrack = hybrid ? 'hybrid' : 'core'
  const paint = tierPaint(track)
  const head = (
    <Head
      title={name}
      paint={paint}
      chips={
        // The kind and whose it is are marks; what it opens from, its relation (C2).
        // The paths are one list of Compacts (Compact frames, one width): its lines
        // share every class's lane (C6).
        <Chips
          size="mini"
          chips={{ durations: [], facts: [], tags: [] }}
          marks={[
            <Stat key="kind" label={kind} size="mini" />,
            ...(path.hybrid && path.via
              ? []
              : [<Stat key="only" label={`${classEntity.name} only`} size="mini" />]),
          ]}
          nodes={{ relation: <PathRequirement path={path} /> }}
        />
      }
    />
  )
  return (
    <li
      className="su-class-path"
      data-kind={kind.toLowerCase()}
      {...(hybrid ? { id: pathAnchor(hybrid.name) } : {})}
    >
      {/* The Compact's frame (`Box`, standing in `CompactFrame`) under the Compact's
          `Head`: drawn through the forms (hard rule R7), never a frame of its own.
          Flush, so the foot's rule spans the frame. */}
      <Box
        body="flush"
        // The frame wears the head's paint (R38).
        frameColor={paint.background}
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
            {/* The class's own path holds its trees once: a TREE chip lands there. */}
            <TreeSection
              {...path.advanced}
              track={hybrid ? 'hybrid' : 'advanced'}
              size="mini"
              anchored={!hybrid}
            />
            {path.legendary && (
              <TreeSection {...path.legendary} track="legendary" size="mini" anchored={!hybrid} />
            )}
          </div>
        </div>
        {/* The foot shares the head's colour, its citation on a paper cut-out,
            as a page's foot band does; text, never chips (EDL E9). */}
        <p className="su-class-path__foot" style={{ backgroundColor: TIER_BAND[track] }}>
          <span className="su-class-path__cite">
            {componentsCopy('workshopManualP', { page: (hybrid ?? classEntity).page })}
          </span>
        </p>
      </Box>
    </li>
  )
}

/** Where the contents land: the sections that are no tree (a tree's is `treeAnchor`). */
const TRAINING_ID = 'training'
const ABILITIES_ID = 'abilities'
const REQUIRED_ID = 'required-trees'
/** A Hybrid Class's path card on a Core class's page: `path-fabricator`. */
const pathAnchor = (name: string) => `path-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

/**
 * ON THIS PAGE: a class Page's sections as links, the Page's first block. A
 * class reads as one long column on a phone (the art, Training, its Core
 * trees, then every path it advances along), so the list stands over the art,
 * where that scroll starts; from `lg` it runs the page's measure over both
 * tracks (`pages-class.css`). Every entry lands on a heading the page has.
 */
export function ClassContents({ classEntity }: ClassAbilityTreeProps) {
  const plan = useMemo(() => resolveClassPlan(classEntity), [classEntity])
  if (plan.kind === 'none') return null
  const entries: { href: string; label: string }[] = [
    { href: TRAINING_ID, label: componentsCopy('training') },
  ]
  if (plan.kind === 'hybrid') {
    entries.push({ href: ABILITIES_ID, label: componentsCopy('abilities') })
    if (plan.branches.some((branch) => branch.group))
      entries.push({ href: REQUIRED_ID, label: componentsCopy('requiredTrees') })
  } else {
    for (const group of plan.coreTrees)
      entries.push({ href: treeAnchor(group.tree), label: group.tree })
    const paths = [...plan.paths].sort(
      (a, b) => Number(Boolean(a.hybrid)) - Number(Boolean(b.hybrid))
    )
    for (const path of paths) {
      if (path.hybrid) {
        entries.push({ href: pathAnchor(path.hybrid.name), label: path.hybrid.name })
        continue
      }
      entries.push({ href: treeAnchor(path.advanced.tree), label: path.advanced.tree })
      if (path.legendary)
        entries.push({ href: treeAnchor(path.legendary.tree), label: path.legendary.tree })
    }
  }
  return (
    <nav className="su-class-contents" aria-label={componentsCopy('onThisPage')}>
      <Slab label={componentsCopy('onThisPage')} flush />
      <ul className="su-class-contents__list">
        {entries.map((entry) => (
          <li key={entry.href}>
            <a className={cn('su-class-contents__link', FOCUS_RING)} href={`#${entry.href}`}>
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * How many of a class's Core trees stand in the main track. A class with no
 * Advancement (the Salvager: twelve Core trees, no path) has nothing for the
 * side track under its art, so its later trees flow there instead, a pair at
 * a time: the main track keeps the first half, rounded up to a whole pair.
 */
function mainCoreCount(plan: Extract<ClassPlan, { kind: 'core' }>): number {
  const count = plan.coreTrees.length
  if (plan.paths.length > 0 || count < 4) return count
  return Math.ceil(count / 4) * 2
}

function coreTreesSection(trees: Extract<ClassPlan, { kind: 'core' }>['coreTrees']) {
  return (
    <SlabSection title={componentsCopy('coreTrees')} page>
      <div className="su-class-path__trees su-class-path__trees--pair" data-entity-fit="">
        {trees.map((group) => (
          <TreeSection key={group.tree} {...group} track="core" />
        ))}
      </div>
    </SlabSection>
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
        <SlabSection id={ABILITIES_ID} title={componentsCopy('abilities')} page>
          <div className="su-class-path__trees" data-entity-fit="">
            <TreeSection {...path.advanced} track="hybrid" />
            {path.legendary && <TreeSection {...path.legendary} track="legendary" />}
          </div>
        </SlabSection>
        <BranchTrees branches={branches} />
      </div>
    )
  }

  // The Core trees two across, on the path cards' shared rows. The paths the
  // class advances along are `ClassAdvancement`'s, which a Page stands in its
  // side track, under the art.
  return (
    <div className="su-ability-tree">
      <ClassBrief plan={plan} />
      {plan.coreTrees.length > 0 && coreTreesSection(plan.coreTrees.slice(0, mainCoreCount(plan)))}
    </div>
  )
}

/**
 * Every path a (base) class advances along, its own (Legendary) first, then
 * each Hybrid Class, all the same card with their trees side by side. A
 * Hybrid Class's page has none: its trees are `ClassAbilityTree`'s.
 */
export function ClassAdvancement({ classEntity }: ClassAbilityTreeProps) {
  const plan = useMemo(() => resolveClassPlan(classEntity), [classEntity])
  if (plan.kind !== 'core') return null
  // No path: the Core trees the main track leaves (`mainCoreCount`).
  const rest = plan.coreTrees.slice(mainCoreCount(plan))
  if (plan.paths.length === 0) {
    return rest.length > 0 ? (
      <div className="su-ability-tree su-ability-tree--more">{coreTreesSection(rest)}</div>
    ) : null
  }
  return (
    <div className="su-ability-tree">
      <SlabSection title={componentsCopy('advancement')} page>
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
    <SlabSection id={REQUIRED_ID} title={componentsCopy('requiredTrees')} page>
      <div className="su-ability-tree__row" data-entity-fit="">
        {groups.map(({ group, owner }) => (
          <TreeSection key={group.tree} {...group} track="core" note={owner?.name} />
        ))}
      </div>
    </SlabSection>
  )
}
