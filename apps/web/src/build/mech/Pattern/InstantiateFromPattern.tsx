/**
 * InstantiateFromPattern — creates a fresh Mech from a MechPattern.
 *
 * The new mech is `mechFromPattern`'s: the pattern's chassis and
 * loadout under the pattern's name, full SP/EP from the chassis, Heat 0, an
 * empty hold — a mech built from a pattern starts fresh — and the pattern it
 * came from in `sourcePattern`, which the pattern page counts. The db
 * layer gives it a fresh id and timestamps.
 *
 * Enforcement regime: NONE, deliberately —
 * instantiate is a Blank-family shortcut and its write path is untouched.
 * It adds PRESENTATION only: saved MechPatterns carry no stored
 * `legalStarting` data tag (the flag is never computed — project data
 * convention), so the confirm dialog names the freeform nature before
 * stamping the mech.
 */

import type { MechPattern } from 'game-domain/schemas/pattern'
import { useState } from 'react'
import { useServerAction } from '../../../lib/connection/useServerAction'
import { mechFromPattern } from '../../../lib/patterns/patterns'
import { useEntityStore } from '../../../stores/entityStore'
import { Button, ConfirmDialog, FieldError, Stack } from '../../../components/index'

type InstantiateFromPatternProps = {
  pattern: MechPattern
  /** Called with the new mech id after entityStore.create resolves. */
  onSuccess: (mechId: string) => void
}

export function InstantiateFromPattern({ pattern, onSuccess }: InstantiateFromPatternProps) {
  const [confirming, setConfirming] = useState(false)
  const build = useServerAction(
    () => useEntityStore.getState().create('mech', mechFromPattern(pattern)),
    { failure: 'The mech could not be built from this pattern. Try again.' }
  )
  const { pending: isInstantiating, error } = build

  async function handleInstantiate() {
    const result = await build.run()
    if (result.ok) onSuccess(result.value.id)
  }

  return (
    <Stack gap={4}>
      <Button
        type="button"
        size="compact"
        onClick={() => setConfirming(true)}
        disabled={isInstantiating}
        // "Build With This", as every build action reads (owner's call,
        // 2026-10-13); the accessible name starts with it and says what it builds.
        aria-label={`Build With This: a mech from ${pattern.name}`}
      >
        {isInstantiating ? 'Building…' : 'Build With This'}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Build a mech from ${pattern.name}?`}
        body="This may exceed the starting rules — a freeform build, like Blank. It stamps the mech exactly as saved; edit freely on its live sheet."
        confirmLabel="Build"
        onConfirm={() => void handleInstantiate()}
      />
      {error && <FieldError>{error}</FieldError>}
    </Stack>
  )
}
