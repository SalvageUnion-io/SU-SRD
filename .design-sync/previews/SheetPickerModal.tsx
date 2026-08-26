/*
 * No story file — `SheetPickerModal` is the ModalShell preset the live-sheet
 * pickers use. Composed from its props contract and that call site: it wraps a
 * single `EntitySearcher`, which is what `floating` exists for.
 *
 * Rendered `open` for the same reason `ModalShell` is — a card cannot press a
 * trigger.
 */
import { EntitySearcher, SheetPickerModal } from 'component-lib'

/**
 * `floating` — a BARE ModalShell handing its single `EntitySearcher` child its
 * own frame. This is the picker shape every sheet "add an entity" flow renders.
 */
export function Picker() {
  return (
    <div className="min-h-[600px] bg-paper">
      <SheetPickerModal open onClose={() => {}} title="Add Equipment" floating>
        <EntitySearcher
          schema="equipment"
          selected={[]}
          onToggle={() => {}}
          chosenLabel="Chosen"
          title="Add Equipment"
          onClose={() => {}}
        />
      </SheetPickerModal>
    </div>
  )
}

/** The framed form — ordinary content rather than a searcher. */
export function Framed() {
  return (
    <div className="min-h-[420px] bg-paper">
      <SheetPickerModal open onClose={() => {}} title="Rename Pattern" maxWidth="32rem">
        <div className="p-4">
          <p className="font-body text-sm text-wk-muted">
            A plain modal body — the picker preset without the floating searcher frame.
          </p>
        </div>
      </SheetPickerModal>
    </div>
  )
}
