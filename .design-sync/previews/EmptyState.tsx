/* Ported from packages/component-lib/src/components/chrome/EmptyState.stories.tsx. */
import { Button, EmptyState } from 'component-lib'

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
        icon={
          // `Glyph` is internal to component-lib, so the preview draws its own
          // decorative plus rather than reaching past the public API.
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            aria-hidden="true"
            className="size-7 text-wk-muted"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        }
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
