import { Text, ValueDisplay } from 'suref-react'

type PilotListingSplitHeaderProps = {
  callsign: string
  pilotClassName: string
  abilityCount?: number
  chassisName: string
  patternName?: string
  compact?: boolean
}

/** Clip-path for the orange (left/pilot) side — covers 0% to the staircase diagonal. */
const ORANGE_CLIP_PATH = `polygon(
  0% 0%,
  calc(50% + 35px) 0%,
  calc(50% + 35px) 12.5%,
  calc(50% + 25px) 12.5%,
  calc(50% + 25px) 25%,
  calc(50% + 15px) 25%,
  calc(50% + 15px) 37.5%,
  calc(50% + 5px) 37.5%,
  calc(50% + 5px) 50%,
  calc(50% - 5px) 50%,
  calc(50% - 5px) 62.5%,
  calc(50% - 15px) 62.5%,
  calc(50% - 15px) 75%,
  calc(50% - 25px) 75%,
  calc(50% - 25px) 87.5%,
  calc(50% - 35px) 87.5%,
  calc(50% - 35px) 100%,
  0% 100%
)`

const OVERLAY_INSET = { inset: '-10px -30px' }

export function PilotListingSplitHeader({
  callsign,
  pilotClassName,
  abilityCount,
  chassisName,
  patternName,
  compact = false,
}: PilotListingSplitHeaderProps) {
  const titleSize = compact ? 'text-xl' : 'text-[1.75rem]'

  return (
    <div className="relative flex w-full self-stretch">
      {/* Green base — covers everything, clipped at card edge by overflow-hidden */}
      <div
        className="pointer-events-none absolute z-0"
        style={{ ...OVERLAY_INSET, backgroundColor: 'var(--color-su-green)' }}
      />
      {/* Orange overlay — clipped to left side + staircase diagonal */}
      <div
        className="pointer-events-none absolute z-[1]"
        style={{
          ...OVERLAY_INSET,
          backgroundColor: 'var(--color-su-orange)',
          clipPath: ORANGE_CLIP_PATH,
        }}
      />

      {/* Content: two halves */}
      <div className="relative z-10 flex w-full items-stretch gap-4">
        {/* Left: Pilot side (title top, data bottom) */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <Text variant="pseudoheader" className={titleSize}>
            {callsign}
          </Text>
          <div className="flex flex-wrap gap-1">
            <ValueDisplay label="The" value={pilotClassName} compact={compact} />
            {abilityCount !== undefined && (
              <ValueDisplay label="Abilities" value={abilityCount} compact={compact} />
            )}
          </div>
        </div>

        {/* Right: Mech side (data top, title bottom) */}
        <div className="flex min-w-0 flex-1 flex-col items-end justify-center gap-0.5">
          <div className="flex flex-wrap justify-end gap-1">
            <ValueDisplay label="Chassis" value={chassisName} compact={compact} />
          </div>
          <Text variant="pseudoheader" className={`self-end ${titleSize}`}>
            {patternName || chassisName}
          </Text>
        </div>
      </div>
    </div>
  )
}
