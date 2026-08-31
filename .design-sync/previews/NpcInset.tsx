/*
 * Ported from packages/component-lib/src/components/sheet/NpcInset.stories.tsx.
 * The story's `NpcFactsEditor` and `SheetActionsMenu` clusters are dropped —
 * the first is not on the public barrel, and the second has its own card.
 */
import { NpcInset } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/**
 * A crawler bay's resident NPC — every field inline-editable in place. The app
 * supplies the values and the save handlers.
 */
export function BayCrew() {
  return (
    <div className="sheet--crawler flex flex-col gap-4 bg-paper p-4">
      <Caption>Medical Bay — a fully filled NPC</Caption>
      <NpcInset
        bayName="Medical Bay"
        name="Sparks"
        hp={8}
        maxHp={10}
        keepsake="A cracked visor"
        motto="Everyone walks away."
        detail="Crawler medic, three tours in the wastes."
        facts={['Owes the Union a favour']}
        onNameChange={() => {}}
        onHpChange={() => {}}
        onFactsChange={() => {}}
      />
    </div>
  )
}

/** A bare NPC — nothing but a name and vitals filled in yet. */
export function Unfilled() {
  return (
    <div className="sheet--crawler flex flex-col gap-4 bg-paper p-4">
      <Caption>Command Bay — the empty fields still hold their places</Caption>
      <NpcInset
        bayName="Command Bay"
        name="Vex"
        hp={10}
        maxHp={10}
        facts={[]}
        onNameChange={() => {}}
        onHpChange={() => {}}
        onFactsChange={() => {}}
      />
    </div>
  )
}
