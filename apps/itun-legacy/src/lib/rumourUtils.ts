export type RumourReceipt = {
  rumour_text: string
}

/** Check if a pilot has received a rumour this downtime */
export function hasReceivedRumour(receipt: RumourReceipt | undefined): boolean {
  return !!receipt && receipt.rumour_text.length > 0
}
