/* Ported from packages/component-lib/src/components/chrome/EmptyState.stories.tsx. */
import { Button, EmptyState, Glyph } from 'component-lib'

/** headline + body + action — stamp voice, dashed = fillable, one rust action. */
export function WithAction() {
  return (
    <div className="max-w-sm bg-paper p-4">
      <EmptyState
        headline="No mechs yet"
        body="Build your first chassis to see it here."
        action={
          <Button variant="primary" size="compact">
            New mech ▸
          </Button>
        }
      />
    </div>
  )
}

/** headline only — the minimal empty slot. */
export function HeadlineOnly() {
  return (
    <div className="max-w-sm bg-paper p-4">
      <EmptyState headline="No pilots yet" />
    </div>
  )
}

/**
 * `variant="quiet"` — the muted app-chrome placeholder: centered, faint dashed
 * frame, decorative glyph, no stamp.
 */
export function Quiet() {
  return (
    <div className="max-w-sm bg-paper p-4">
      <EmptyState
        variant="quiet"
        icon={<Glyph name="gear" className="size-7 text-wk-muted" />}
        body="No systems installed yet."
        action={
          <Button variant="primary" size="compact">
            + Add system
          </Button>
        }
      />
    </div>
  )
}
