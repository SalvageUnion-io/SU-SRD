import { Stat } from 'component-lib'
import { MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'

/**
 * Step 1 · Gain Scrap (Mech Workshop p.94) — display-only briefing step. You
 * start with 20 Tech 1 Scrap; the whole build debits this one pool, so the
 * SCRAP tracker makes its first appearance here (and rides in the action
 * pill for the rest of the wizard). Nothing to choose — Next always enabled.
 */
export function GainScrapStep() {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Stat label="SCRAP" value={MECH_CREATION_SCRAP_CAP} max={MECH_CREATION_SCRAP_CAP} compact />
      <p className="m-0 max-w-[52ch] self-center font-body text-sm leading-relaxed text-current">
        Every purchase in this workshop — the Chassis, each System, each Module — debits this one
        pool. Whatever is left over banks to your Union Crawler when the build is done.
      </p>
    </div>
  )
}
