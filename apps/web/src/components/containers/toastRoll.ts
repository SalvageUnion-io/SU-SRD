/** A roll as its toast reads it: the table, the die and where it landed. */
export type AnnouncedRoll = {
  /** The table's name. */
  table: string
  /** The die. */
  roll: number
  /**
   * The range it landed in, as the book prints it ("11–19", "column 9–12");
   * absent when the table has no row for the roll.
   */
  range?: string
  /** The outcome's name, where the row has one ("Success"). */
  label?: string
  /** The outcome's text, trait references read as plain words. */
  text: string
}

/**
 * Every roll's result, wherever it is rolled (a card's table, a roll table's
 * own page): one toast with the die and the range it lands on, then the
 * outcome's name and text. A reroll on the same table replaces its toast
 * rather than stacking another. It shows in the document's one toaster
 * (`ToasterMount`). Sonner loads with the first roll, so a reference page's
 * islands do not carry it until a reader rolls.
 */
export function toastRoll({ table, roll, range, label, text }: AnnouncedRoll): void {
  void import('sonner').then(({ toast }) =>
    toast(range ? `${table}: rolled ${roll} (${range})` : `${table}: rolled ${roll}`, {
      id: rollToastId(table),
      description: label ? `${label}: ${text}` : text,
      duration: 8000,
    })
  )
}

/** A table's one roll toast. */
function rollToastId(table: string): string {
  return `roll-${table}`
}

/**
 * Takes down a table's roll toast: a new roll shown where the reader looks
 * replaces the last one's line rather than leaving it to contradict the row
 * (RR8-05).
 */
export function dismissRoll(table: string): void {
  void import('sonner').then(({ toast }) => toast.dismiss(rollToastId(table)))
}
