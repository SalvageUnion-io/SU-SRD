import type { SURefObjectTable, SURefObjectTableContent } from '../types/index.js'

/**
 * Result type for table roll resolution
 */
export type TableRollResult = {
  success: boolean
  result: SURefObjectTableContent
  key: string
}

/**
 * Resolves a d20 roll against a table to get the result
 *
 * @param table - The roll table data (SURefRollTable['table'] | SURefSystem['table'] | undefined)
 * @param roll - The d20 roll result (1-20)
 * @returns Object with success flag and result object containing optional label and required value
 *
 * @example
 * const rollTable = SalvageUnionReference.RollTables.findByName('Core Mechanic');
 * const result = resultForTable(rollTable?.table, 15);
 * if (result.success) {
 *   console.log(result.result.value); // "You have achieved your goal..."
 *   console.log(result.result.label); // "Success" (if present)
 * }
 */
export function resultForTable(table: SURefObjectTable | undefined, roll: number): TableRollResult {
  if (!table) {
    return {
      success: false,
      result: { value: 'Table data is undefined' },
      key: '',
    }
  }

  if (roll < 1 || roll > 20) {
    return {
      success: false,
      result: { value: `Roll must be between 1 and 20, got ${roll}` },
      key: '',
    }
  }

  const tableData = table as Record<string, unknown>
  const numericKeys = Object.keys(tableData).filter((k) => /^\d+(-\d+)?$/.test(k))

  // Detect if this is a flat table (has all 20 individual keys)
  if (numericKeys.length === 20 && numericKeys.every((k) => !k.includes('-'))) {
    const key = roll.toString()
    const result = tableData[key]
    const formattedResult = formatTableContent(result)
    if (formattedResult) {
      return {
        success: true,
        result: formattedResult,
        key,
      }
    }
    return {
      success: false,
      result: { value: `No result found for roll ${roll} in flat table` },
      key: '',
    }
  }

  return findRangeResult(tableData, roll)
}

/**
 * Formats table content to the new format: { label?: string, value: string }
 * Handles both old string format and new tableContent object format
 */
function formatTableContent(content: unknown): { label?: string; value: string } | null {
  if (!content) return null

  // Handle new tableContent format: { label?: string, value: string }
  if (typeof content === 'object' && content !== null && 'value' in content) {
    const tableContent = content as { label?: string; value: string }
    if (typeof tableContent.value === 'string') {
      return {
        label: typeof tableContent.label === 'string' ? tableContent.label : undefined,
        value: tableContent.value,
      }
    }
  }

  // Handle old string format: "Label: Description" or just "Description"
  if (typeof content === 'string') {
    const parts = content.split(':')
    const labelPart = parts[0]?.trim()
    const valuePart = parts.slice(1).join(':').trim()

    // If there's a label part and it's different from the value, include it
    if (labelPart && labelPart !== valuePart && valuePart) {
      return {
        label: labelPart,
        value: valuePart,
      }
    }

    // Otherwise, just return the string as the value
    return {
      value: content,
    }
  }

  return null
}

/**
 * Finds the result for a given roll in a range-based table
 * Automatically detects the range structure from available keys
 */
function findRangeResult(rollTable: Record<string, unknown>, roll: number): TableRollResult {
  const exactKey = roll.toString()
  const exactResult = rollTable[exactKey]
  const formattedExactResult = formatTableContent(exactResult)
  if (formattedExactResult) {
    return {
      success: true,
      result: formattedExactResult,
      key: exactKey,
    }
  }

  // Get all numeric range keys (e.g., "2-5", "11-19")
  // Filter out "type" key
  const rangeKeys = Object.keys(rollTable).filter((k) => k.includes('-') && k !== 'type')

  for (const rangeKey of rangeKeys) {
    if (rollInRange(roll, rangeKey)) {
      const result = rollTable[rangeKey]
      const formattedResult = formatTableContent(result)
      if (formattedResult) {
        return {
          success: true,
          result: formattedResult,
          key: rangeKey,
        }
      }
    }
  }

  return {
    success: false,
    result: { value: `No result found for roll ${roll}` },
    key: '',
  }
}

/**
 * Checks if a roll falls within a range string
 * Handles formats like "1", "2-5", "11-19", etc.
 */
function rollInRange(roll: number, range: string): boolean {
  // Single value
  if (!range.includes('-')) {
    return roll === parseInt(range, 10)
  }

  // Range format "X-Y"
  const parts = range.split('-')
  const minStr = parts[0]
  const maxStr = parts[1]
  if (!minStr || !maxStr) return false
  const min = parseInt(minStr, 10)
  const max = parseInt(maxStr, 10)

  return roll >= min && roll <= max
}
