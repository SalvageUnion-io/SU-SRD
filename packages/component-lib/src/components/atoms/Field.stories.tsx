import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Field, Select } from './Field'
import { Input, Textarea } from './inputs'

export default {
  title: 'Atoms/Field',
}

/** Base pilot classes (those with core trees), driven from real SRD data. */
function baseClasses(): string[] {
  return SalvageUnionReference.Classes.all()
    .filter((c) => 'coreTrees' in c && Array.isArray(c.coreTrees) && c.coreTrees.length > 0)
    .map((c) => c.name)
}

// Real SRD content for the standalone Input row.
const chassisName = SalvageUnionReference.Chassis.all()[0]?.name ?? 'Chassis'
const systemName = SalvageUnionReference.Systems.all()[0]?.name ?? 'System'
const crawlerName = SalvageUnionReference.Crawlers.all()[0]?.name ?? 'Crawler'

const stack = (gap: string) =>
  ({ display: 'flex', flexDirection: 'column', gap }) satisfies CSSProperties

const PAGE = {
  ...stack(space[32]),
  backgroundColor: color.paper,
  maxWidth: '28rem',
  padding: space[32],
} satisfies CSSProperties

const CELL = stack(space[8])

/** The compact call-site: padding and the 44px floor overridden by `style`. */
const COMPACT_SELECT = {
  minHeight: 0,
  paddingBlock: space[6],
  paddingInline: space[8],
} satisfies CSSProperties

/** The USED plate riding the opposite seam. */
const USED_PLATE = {
  backgroundColor: color.ink,
  border: `${borderWidth.pill} solid ${color.ink}`,
  borderRadius: radius.full,
  color: color.paper,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsWide,
  lineHeight: 1,
  padding: `${space[2]} ${space[8]}`,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** Field wrapping each control — Input, Textarea, Select — all one skin. */
export const Default: Story = () => (
  <div style={PAGE}>
    <div style={CELL}>
      <Caption>Field + Input — stamp label straddling the input's top border.</Caption>
      <Field label="Callsign" htmlFor="callsign" required>
        <Input id="callsign" placeholder="Ace" />
      </Field>
    </div>

    <div style={CELL}>
      <Caption>Field + Textarea — the multiline Input sibling (vertical resize).</Caption>
      <Field label="Motto" htmlFor="motto">
        <Textarea id="motto" placeholder="A line that fits on a dog tag." />
      </Field>
    </div>

    <div style={CELL}>
      <Caption>Field + Select — native select in the Input skin (real pilot classes).</Caption>
      <Field label="Class" htmlFor="class">
        <Select id="class" defaultValue="">
          <option value="" disabled>
            Choose a class…
          </option>
          {baseClasses().map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>
    </div>

    <div style={CELL}>
      {/* The caption keeps its original wording so the page's pixels hold; the
          override itself is now a `style`, which wins over `.su-select`. */}
      <Caption>Select — compact call-site (px-2 py-1.5 via className).</Caption>
      <Select aria-label="Tech level" style={COMPACT_SELECT} defaultValue="1">
        <option value="1">Tech Level 1</option>
        <option value="2">Tech Level 2</option>
        <option value="3">Tech Level 3</option>
      </Select>
    </div>

    <div style={CELL}>
      <Caption>Input — standalone variants (empty · filled · disabled).</Caption>
      <div style={stack(space[12])}>
        <Input placeholder={`e.g. ${systemName}`} />
        <Input defaultValue={chassisName} />
        <Input disabled defaultValue={crawlerName} />
      </div>
    </div>
  </div>
)

/**
 * Edit-in-place & picker — the absorbed IdentityField. Same straddling stamp;
 * the dashed edit cue (not a pen) marks an editable field. Read-only fields
 * carry a plain ink border. The sheet identity rows render exactly this way.
 */
export const Identity: Story = () => {
  const [callsign, setCallsign] = useState('Ace')
  const [motto, setMotto] = useState('No retreat, no surrender')

  return (
    <div className="sheet--pilot" style={PAGE}>
      <div style={CELL}>
        <Caption>Edit-in-place, editing — dashed cue = "write here"; click to type.</Caption>
        <Field label="Callsign" value={callsign} onSave={setCallsign} />
      </div>

      <div style={CELL}>
        <Caption>
          Read state — typeset: the label over the value, no box (board 10). An empty value renders
          nothing.
        </Caption>
        <Field label="Callsign" value={callsign} />
        <Field label="Motto" value={motto} multiline />
        <Field label="Pronouns" value="" />
      </div>

      <div style={CELL}>
        <Caption>Picker-backed — a button box opening the shared modal (real class).</Caption>
        <Field label="Class" value={baseClasses()[0] ?? 'Salvager'} onEditClick={() => {}} />
      </div>

      <div style={CELL}>
        <Caption>Multiline + labelAction — the USED plate rides the opposite seam.</Caption>
        <Field
          label="Motto"
          value={motto}
          multiline
          onSave={setMotto}
          labelAction={<span style={USED_PLATE}>Used</span>}
        />
      </div>
    </div>
  )
}
