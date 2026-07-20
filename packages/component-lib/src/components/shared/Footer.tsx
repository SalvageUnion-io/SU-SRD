type FooterProps = {
  /** URL for the "Powered by Salvage" logo image — passed by consuming app */
  poweredBySalvageUrl: string
}

export function Footer({ poweredBySalvageUrl }: FooterProps) {
  return (
    <footer className="border-t border-wk-faint bg-paper py-3 lg:shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-row flex-wrap items-center justify-center gap-4 text-xs text-ink">
        <div className="min-w-0 flex-1 text-center">
          <p>
            Salvage Union is copyrighted by{' '}
            <a
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-rust"
            >
              Leyline Press
            </a>
            .
          </p>
          <p>
            Salvage Union and the &quot;Powered by Salvage&quot; logo are used with permission of
            Leyline Press, under the{' '}
            <a
              href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-rust"
            >
              Salvage Union Open Game Licence 1.0b
            </a>
            .
          </p>
          <p>
            All Workshop Manual Images are used with special permission from{' '}
            <a
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-rust"
            >
              Leyline Press
            </a>
            .
          </p>
        </div>
        <div className="inline-block shrink-0 rounded-md p-2">
          <img
            src={poweredBySalvageUrl}
            alt="Powered by Salvage"
            className="h-12 w-auto"
            width={120}
            height={48}
          />
        </div>
      </div>
    </footer>
  )
}
