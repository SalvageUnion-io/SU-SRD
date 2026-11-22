/**
 * The book's italics in rules text: a `*sentence*` the data keeps as the book
 * printed it (the Blue Mining Laser's safety note), drawn in italics at
 * display and never by editing the data (r5 E13). A `**bold**` run is not
 * italics and is left as it is.
 */

/** One italic run: the indices of its opening and closing asterisks in the text. */
export type EmphasisRun = { open: number; close: number }

const ITALIC = /(?<!\*)\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?!\*)/g

/** The italic runs in `text`, in order. */
export function emphasisRuns(text: string): EmphasisRun[] {
  return [...text.matchAll(ITALIC)].map((match) => ({
    open: match.index,
    close: match.index + match[0].length - 1,
  }))
}

/** A piece of a text run: its words, and whether they sit inside an italic run. */
export type EmphasisPiece = { text: string; start: number; italic: boolean }

/**
 * The text run `text`, starting at `start` in the source, cut at the italic
 * runs' asterisks, which it drops: each piece says whether it is italic.
 */
export function splitEmphasis(text: string, start: number, runs: EmphasisRun[]): EmphasisPiece[] {
  const pieces: EmphasisPiece[] = []
  const end = start + text.length
  let at = start
  const push = (to: number) => {
    if (to > at)
      pieces.push({ text: text.slice(at - start, to - start), start: at, italic: inside(at, runs) })
  }
  for (const run of runs) {
    for (const mark of [run.open, run.close]) {
      if (mark < at || mark >= end) continue
      push(mark)
      at = mark + 1
    }
  }
  push(end)
  return pieces
}

/** Whether the character at `index` sits between an italic run's asterisks. */
export function inside(index: number, runs: EmphasisRun[]): boolean {
  return runs.some((run) => index > run.open && index < run.close)
}
