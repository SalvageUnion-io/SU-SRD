import type { ReactNode } from 'react'

type SheetFooterProps = {
  saveStatusText?: string
  leftContent?: ReactNode
  rightContent?: ReactNode
}

export function SheetFooter({ saveStatusText, leftContent, rightContent }: SheetFooterProps) {
  return (
    <div className="flex w-full items-center justify-between px-2 py-1">
      <div className="flex items-center gap-3">
        {leftContent}
        {saveStatusText && (
          <span className="font-mono text-xs text-su-white/70">{saveStatusText}</span>
        )}
      </div>
      {rightContent && <div className="flex items-center gap-2">{rightContent}</div>}
    </div>
  )
}
