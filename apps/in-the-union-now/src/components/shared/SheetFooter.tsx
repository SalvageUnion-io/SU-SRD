import type { ReactNode } from 'react'

type SheetFooterProps = {
  saveStatusText?: string
  leftContent?: ReactNode
  rightContent?: ReactNode
  compact?: boolean
}

export function SheetFooter({
  saveStatusText,
  leftContent,
  rightContent,
  compact,
}: SheetFooterProps) {
  return (
    <div
      className={`flex w-full items-center justify-between ${compact ? 'px-1.5 py-px' : 'px-2 py-1'}`}
    >
      <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-3'}`}>
        {leftContent}
        {saveStatusText && (
          <span className="font-mono text-xs text-su-white/70">{saveStatusText}</span>
        )}
      </div>
      {rightContent && (
        <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>{rightContent}</div>
      )}
    </div>
  )
}
