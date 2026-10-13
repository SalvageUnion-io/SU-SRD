import { tokens } from 'component-lib'
import type { Story } from 'component-lib/stories/harness'
import type { CSSProperties, ReactNode } from 'react'
import { getEntitySlug, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { EMPTY_CRAWLER_FORM_STATE } from '../../lib/wizard/crawlerFormState'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import { EMPTY_MECH_FORM_STATE } from '../../lib/wizard/mechFormState'
import type { PilotWizardFormState } from '../../lib/wizard/pilotFormState'
import { EMPTY_PILOT_FORM_STATE } from '../../lib/wizard/pilotFormState'
import { CrawlerCrewStep } from '../crawler/CrawlerCrewStep'
import { CrawlerIdentityStep } from '../crawler/CrawlerIdentityStep'
import { CrawlerReviewStep } from '../crawler/CrawlerReviewStep'
import { MechChassisStep } from '../mech/MechChassisStep'
import { MechReviewStep } from '../mech/MechReviewStep'
import { MechStatsStep } from '../mech/MechStatsStep'
import { ReviewStep } from '../pilot/ReviewStep'
import { StatsStep } from '../pilot/StatsStep'
import { BackgroundStep } from './BackgroundStep'
import { CallsignStep } from './CallsignStep'
import { ClassAbilityStep } from './ClassAbilityStep'
import { CrawlerStatsStep } from './CrawlerStatsStep'
import { CrawlerTypeSelectStep } from './CrawlerTypeStep'
import { selectableClasses } from './classOptions.model'
import { FlavorStep } from './FlavorStep'
import { GainScrapStep } from './GainScrapStep'
import { MechFlavorStep } from './MechFlavorStep'
import { RuleBrief } from './RuleBrief'
import { SystemsList } from './SystemsList'
import { WizShell } from './WizShell'

/**
 * Each wizard's step bodies, printed together on that wizard's tinted step
 * card (`--tone-card`), so the catalog's axe scan (`stories-a11y.e2e.ts`)
 * measures their copy on the ground it really sits on. The per-step stories
 * print on paper or the page ground, where a muted colour that fails on the
 * card (`wkMuted`: 3.78 / 3.03 / 2.65:1 on pilot / mech / crawler) still
 * passes. A wizard shows one step at a time; here they stack.
 *
 * These have no baseline entry, so any violation fails the scan. What would
 * need one is kept out, each already carried by its own story's entry:
 * - the stepper rail (`steps` is empty): its tabs lose their names at phone
 *   width (`button-name`, the Wiz Shell story);
 * - the pilot's Equipment step: its Tech-level stat plates measure 3.71:1 on
 *   their own fill (`color-contrast`, the Equipment Step story);
 * - the mech's Systems and Modules steps, and the chassis step's pattern
 *   strip (no chassis is picked): controls inside clickable cards
 *   (`nested-interactive`, the Equipment Step and Selectable Chassis stories).
 * Their only copy on the card is a solid `Slab`'s count, which the steps
 * shown here print the same way.
 */
export default {
  title: 'Compositions/Wizard/Step Card',
}

const SECTION = {
  borderTop: `${tokens.borderWidth.hairline} dashed currentcolor`,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  marginTop: tokens.space[24],
  paddingTop: tokens.space[24],
} satisfies CSSProperties

function Step({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section aria-label={name} style={SECTION}>
      {children}
    </section>
  )
}

const noop = () => {}

function Card({
  kind,
  eyebrow,
  children,
}: {
  kind: 'pilot' | 'mech' | 'crawler'
  eyebrow: string
  children: ReactNode
}) {
  return (
    <WizShell
      kind={kind}
      eyebrow={eyebrow}
      steps={[]}
      active={0}
      title="Every step"
      onNext={noop}
      onCancel={noop}
      submitLabel="Create ✦"
    >
      <RuleBrief
        rule="The step's rule, paraphrased from the book."
        cite={{ source: 'Salvage Union Workshop Manual', page: 18 }}
      />
      {children}
    </WizShell>
  )
}

const { base: classes } = selectableClasses(undefined, true)
const firstClass = classes[0]

const PILOT_FORM: PilotWizardFormState = {
  ...EMPTY_PILOT_FORM_STATE,
  name: 'Vasquez',
  callsign: 'Ratchet',
  classId: firstClass?.id ?? '',
  motto: 'Leave nothing behind.',
}

/** The Pilot Bay's steps on the pilot card. */
export const Pilot: Story = () => (
  <Card kind="pilot" eyebrow="Pilot Bay">
    <Step name="Stats">
      <StatsStep />
    </Step>
    <Step name="Class & Ability">
      <ClassAbilityStep
        classId={firstClass?.id ?? ''}
        selectedAbilities={[]}
        onSelectClass={noop}
        onSelectAbility={noop}
      />
    </Step>
    <Step name="Callsign">
      <CallsignStep name="Vasquez" callsign="Ratchet" onChange={noop} />
    </Step>
    <Step name="Background">
      <BackgroundStep
        background="Salvager"
        onChange={noop}
        description=""
        onDescriptionChange={noop}
      />
    </Step>
    <Step name="Motto">
      <FlavorStep
        field="motto"
        label="Motto"
        value=""
        onChange={noop}
        placeholder="A phrase your pilot lives by"
      />
    </Step>
    <Step name="Review">
      <ReviewStep form={PILOT_FORM} submitError={null} />
    </Step>
  </Card>
)

const chassis = SalvageUnionReference.Chassis.all().find((c) => c.techLevel === 1)

const MECH_FORM: MechWizardFormState = {
  ...EMPTY_MECH_FORM_STATE,
  name: 'Bullseye Pattern',
  chassisName: chassis ? nameToSlug(chassis.name) : '',
  quirk: 'Rattletrap',
}

/** The Mech Workshop's steps on the mech card. */
export const Mech: Story = () => (
  <Card kind="mech" eyebrow="Mech Workshop">
    <Step name="Gain Scrap">
      <GainScrapStep />
    </Step>
    <Step name="Chassis">
      <MechChassisStep
        chassisName=""
        patternName=""
        onSelectChassis={noop}
        onSelectPattern={noop}
        onSelectCustom={noop}
      />
    </Step>
    <Step name="Statistics">
      <MechStatsStep chassisName={MECH_FORM.chassisName} />
    </Step>
    <Step name="Pattern name">
      <MechFlavorStep
        field="patternName"
        label="Name / Pattern"
        value=""
        onChange={noop}
        placeholder="e.g. Bullseye Pattern Mule"
        note="A mech's name IS its pattern — one name covers both."
      />
    </Step>
    <Step name="Review">
      <MechReviewStep form={MECH_FORM} submitError={null} bankedScrap={5} />
    </Step>
  </Card>
)

const crawlerTypes = SalvageUnionReference.Crawlers.all()
const crawlerType = crawlerTypes[0]
const crawlerTypeSlug = crawlerType ? getEntitySlug(crawlerType) : null
const crewBays = SalvageUnionReference.CrawlerBays.all().filter(
  (b) => (b as { npc?: unknown }).npc != null
)
const weapons = SalvageUnionReference.Systems.all().slice(0, 3)
const techLevel = SalvageUnionReference.CrawlerTechLevels.all()[0]

const CRAWLER_FORM: CrawlerWizardFormState = {
  ...EMPTY_CRAWLER_FORM_STATE,
  name: 'Tin Lizzy',
  type: crawlerTypeSlug,
}

/** The Union Crawler's steps on the crawler card. */
export const Crawler: Story = () => (
  <Card kind="crawler" eyebrow="Union Crawler">
    <Step name="Crawler type">
      <CrawlerTypeSelectStep types={crawlerTypes} selectedType={crawlerTypeSlug} onSelect={noop} />
    </Step>
    <Step name="Statistics">
      <CrawlerStatsStep techLevel={techLevel} selectedType={crawlerType} />
    </Step>
    <Step name="Armament Bay">
      <SystemsList
        systems={weapons}
        selectedSystemSlugs={[]}
        installedWeaponCount={0}
        maxSelectable={1}
        onChange={noop}
      />
    </Step>
    <Step name="Crew">
      <CrawlerCrewStep
        bays={crewBays.slice(0, 2)}
        selectedType={crawlerType}
        crew={{}}
        onChange={noop}
      />
    </Step>
    <Step name="Name">
      <CrawlerIdentityStep
        name="Tin Lizzy"
        description=""
        scrapPool={CRAWLER_FORM.scrapPool}
        onChange={noop}
      />
    </Step>
    <Step name="Review">
      <CrawlerReviewStep
        form={CRAWLER_FORM}
        techLevel={techLevel}
        selectedType={crawlerType}
        systems={weapons.slice(0, 1)}
        bayCount={crewBays.length}
        submitError={null}
      />
    </Step>
  </Card>
)
