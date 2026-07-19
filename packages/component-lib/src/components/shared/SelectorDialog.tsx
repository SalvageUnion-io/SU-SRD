/**
 * SelectorDialog — ITUN's standard pick-one-then-confirm dialog.
 *
 * Generic radio-list selector over component-lib's ModalShell, factored out of
 * the formerly copy-pasted AssignPilotToMech / AssignCrawlerToPilot dialogs
 * (design-review T-2/T-3). The caller owns all state (selection, pending,
 * error) — this component is a controlled, dumb view.
 */

import { Button } from '../chrome/Button'
import { ModalShell } from '../shared/ModalShell'

type SelectorOption = {
  id: string
  label: string
  /** Optional muted annotation after the label (e.g. callsign, tech level). */
  sublabel?: string
}

type SelectorDialogProps = {
  open: boolean
  title: string
  /** `name` attribute shared by the radio group inputs. */
  radioGroupName: string
  options: SelectorOption[]
  /** Copy shown when `options` is empty. */
  emptyMessage: string
  selectedId: string
  onSelect: (id: string) => void
  confirmLabel?: string
  /** Label shown on the confirm button while `pending`. */
  pendingLabel?: string
  confirmAriaLabel?: string
  pending?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

export function SelectorDialog({
  open,
  title,
  radioGroupName,
  options,
  emptyMessage,
  selectedId,
  onSelect,
  confirmLabel = 'Assign',
  pendingLabel = 'Assigning…',
  confirmAriaLabel,
  pending = false,
  error = null,
  onConfirm,
  onClose,
}: SelectorDialogProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={title}
      headerBg="bg-su-orange"
      maxWidth="max-w-md"
      align="center"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        {options.length === 0 ? (
          <p className="font-body text-sm text-wk-muted">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded-card border-chrome border-ink bg-paper p-2 hover:bg-wk-bg-2"
              >
                <input
                  type="radio"
                  name={radioGroupName}
                  value={option.id}
                  checked={selectedId === option.id}
                  onChange={() => onSelect(option.id)}
                  className="accent-rust"
                />
                <span className="font-body text-sm font-medium text-ink">{option.label}</span>
                {option.sublabel && (
                  <span className="font-body text-xs text-wk-muted">{option.sublabel}</span>
                )}
              </label>
            ))}
          </div>
        )}

        {error && (
          <p className="font-body text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={pending || options.length === 0}
            aria-label={confirmAriaLabel}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
