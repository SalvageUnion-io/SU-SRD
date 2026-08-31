/*
 * Ported from packages/component-lib/src/components/chrome/InlineEditField.stories.tsx.
 * The story's `Live` wrapper (useState + commit) is dropped: every mode below is
 * the resting render, which is what a card shows.
 */
import { InlineEditField } from 'component-lib'
import type { ReactNode } from 'react'

function Cell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-body text-note text-wk-muted">{caption}</span>
      {children}
    </div>
  )
}

/**
 * Click a value to edit; Enter or blur commits, Esc cancels. Real Salvage Union
 * stats stand in for the values.
 */
export function Modes() {
  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8 text-ink">
      <Cell caption="read — click the value to edit (text)">
        <InlineEditField value=".50 Cal Machine Gun" onSave={() => {}} ariaLabel="Weapon name" />
      </Cell>
      <Cell caption="number — a pilot's HP, 0–16">
        <InlineEditField
          value={16}
          onSave={() => {}}
          type="number"
          min={0}
          max={16}
          ariaLabel="Pilot HP"
        />
      </Cell>
      <Cell caption="textarea — 3-row multiline with placeholder">
        <InlineEditField
          value=""
          onSave={() => {}}
          multiline
          placeholder="Add a motto"
          ariaLabel="Pilot motto"
        />
      </Cell>
    </div>
  )
}

/** The bordered value-box and the inert read-only rendering. */
export function BorderedAndReadOnly() {
  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8 text-ink">
      <Cell caption="bordered — the ink value-box shape Field wraps its stamp around">
        <InlineEditField value="Ace" onSave={() => {}} bordered ariaLabel="Callsign" />
      </Cell>
      <Cell caption="readOnly — plain text, no affordance">
        <InlineEditField value="Mule" onSave={() => {}} readOnly ariaLabel="Chassis" />
      </Cell>
    </div>
  )
}
