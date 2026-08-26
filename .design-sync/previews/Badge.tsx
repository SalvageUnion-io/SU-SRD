/*
 * Ported from packages/component-lib/src/components/chrome/Badge.stories.tsx.
 *
 * The one structural change from the story: every `SalvageUnionReference` read
 * moved from module scope into the render body. Ladle preloads the dataset
 * before it imports a story chunk; these cards have no such gate ahead of the
 * module, only `SalvageUnionDataProvider` around the render — so a top-level
 * read throws "Schema not loaded" and the cell renders empty.
 */
import { Badge } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Row, Stack } from '../preview-lib/harness'

type BadgeTone = 'pilot' | 'mech' | 'crawler' | 'game' | 'ok' | 'warn' | 'bad'

const BADGE_TONES: BadgeTone[] = ['pilot', 'mech', 'crawler', 'game', 'ok', 'warn', 'bad']

function useFixtures() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const traits = SalvageUnionReference.Traits.all()
  const classes = SalvageUnionReference.Classes.all()
  const crawler = SalvageUnionReference.Crawlers.all()[0]
  const traitLabel = (name: string, fallback: string) =>
    traits.find((t) => t.name === name)?.name ?? fallback
  return {
    chassisName: chassis?.name ?? 'Chassis',
    techLabel: `Tech ${chassis?.techLevel ?? 1}`,
    keywords: [
      traitLabel('armour', 'armour'),
      traitLabel('ballistic', 'ballistic'),
      traitLabel('explosive', 'explosive'),
    ],
    economy: ['Turn Action', 'Passive', 'Reaction'],
    tones: {
      pilot: classes[0]?.name ?? 'Pilot',
      mech: chassis?.name ?? 'Chassis',
      crawler: crawler?.name ?? 'Crawler',
      game: 'Mediator',
      ok: 'Intact',
      warn: 'Damaged',
      bad: 'Destroyed',
    } as Record<BadgeTone, string>,
  }
}

/**
 * The unified Badge. Badges are LABEL-ONLY — a label+value readout is a `Stat`
 * with `orientation="horizontal"`, never a Badge.
 */
export function Surfaces() {
  const f = useFixtures()
  return (
    <Stack>
      <Group caption="surface · solid / ghost / outline / quiet">
        <Row>
          <Badge surface="solid">{f.keywords[0]}</Badge>
          <Badge surface="ghost">{f.economy[0]}</Badge>
          <Badge surface="outline">{f.economy[1]}</Badge>
          <Badge surface="quiet">Uses</Badge>
        </Row>
      </Group>
      <Group caption="surface=tone · entity-kind + status fills">
        <Row>
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} surface="tone" tone={tone}>
              {f.tones[tone]}
            </Badge>
          ))}
        </Row>
      </Group>
      <Group caption="surface=outline · ink on paper">
        <Row>
          <Badge surface="outline">Legal Starting</Badge>
          <Badge surface="outline">{f.techLabel}</Badge>
        </Row>
      </Group>
    </Stack>
  )
}

/** A keyword is a single stamped Badge; the ghost surface inverts it. */
export function Keywords() {
  const f = useFixtures()
  return (
    <Stack>
      <Group caption="Keyword (stamped ink chip)">
        <Row>
          {f.keywords.map((keyword) => (
            <Badge key={keyword}>{keyword}</Badge>
          ))}
        </Row>
      </Group>
      <Group caption="Ghost (inverted paper chip, inset ring)">
        <Row>
          {f.economy.map((economy) => (
            <Badge key={economy} surface="ghost">
              {economy}
            </Badge>
          ))}
        </Row>
      </Group>
    </Stack>
  )
}

/**
 * The interactive filter-chip rung (`as="button"`). The call site owns the
 * pressed state and drives `surface` from it, so the Badge stays
 * presentational. Rendered here in a settled mixed state rather than wired to
 * `useState` — a card is a still image, and the pressed/unpressed contrast is
 * the thing worth showing.
 */
export function FilterChips() {
  const f = useFixtures()
  const pressed = new Set([f.keywords[0]])
  const pressedTls = new Set([2, 4])
  return (
    <Stack>
      <Group caption="plain toggle — solid when pressed, ghost when not">
        <Row>
          <Badge shape="chip" as="button" aria-pressed={false} surface="ghost">
            All
          </Badge>
          {f.keywords.map((keyword) => (
            <Badge
              key={keyword}
              shape="chip"
              as="button"
              aria-pressed={pressed.has(keyword)}
              surface={pressed.has(keyword) ? 'solid' : 'ghost'}
            >
              {keyword}
            </Badge>
          ))}
        </Row>
      </Group>
      <Group caption="swatch — the tech-level filter chips">
        <Row>
          {[1, 2, 3, 4, 5, 6].map((tl) => (
            <Badge
              key={tl}
              shape="chip"
              as="button"
              aria-pressed={pressedTls.has(tl)}
              surface={pressedTls.has(tl) ? 'solid' : 'ghost'}
              swatch={`var(--color-tl-${tl})`}
            >
              {`TL${tl}`}
            </Badge>
          ))}
        </Row>
      </Group>
    </Stack>
  )
}

/** The square stamp shape — the ink label/header/tab/eyebrow atom. */
export function Stamps() {
  const f = useFixtures()
  return (
    <Stack>
      <Group caption="surface — on-ink (default) / inverse / on-tone">
        <Row>
          <Badge shape="stamp">{f.chassisName}</Badge>
          <Badge shape="stamp" surface="inverse">
            Structure
          </Badge>
          <span className="inline-block bg-mech px-2 py-1">
            <Badge shape="stamp" surface="on-tone">
              On tone
            </Badge>
          </span>
        </Row>
      </Group>
      <Group caption="size — mini / compact / full">
        <Row>
          <Badge shape="stamp" size="mini">
            SP
          </Badge>
          <Badge shape="stamp" size="compact">
            {f.techLabel}
          </Badge>
          <Badge shape="stamp" size="full">
            {f.chassisName}
          </Badge>
        </Row>
      </Group>
      <Group caption="seam — rides the container's top border">
        <div className="relative mt-2 rounded-card border-2 border-ink bg-paper p-4">
          <Badge shape="stamp" seam className="left-3">
            Systems
          </Badge>
          <p className="m-0 font-body text-sm text-wk-muted">
            A framed body; the stamp straddles the top border.
          </p>
        </div>
      </Group>
    </Stack>
  )
}
