import { describe, it, expect } from 'bun:test'
import { resultForTable } from './resultForTable.js'
import type { SURefObjectTable, SURefRollTable } from '../index.js'

const mockStandardTable: SURefRollTable = {
  id: 'test-standard',
  source: 'Salvage Union Workshop Manual',
  name: 'Test Standard',
  indexable: true,
  blackMarket: false,
  table: {
    '1': { value: 'Critical Failure' },
    '2-5': { value: 'Failure' },
    '6-10': { value: 'Partial Success' },
    '11-19': { value: 'Success' },
    '20': { value: 'Critical Success' },
    type: 'standard',
  },
  page: 1,
}

const mockFlatTable: SURefRollTable = {
  id: 'test-flat',
  source: 'Salvage Union Workshop Manual',
  name: 'Test Flat',
  indexable: true,
  blackMarket: false,
  table: {
    '1': { value: 'Result 1' },
    '2': { value: 'Result 2' },
    '3': { value: 'Result 3' },
    '4': { value: 'Result 4' },
    '5': { value: 'Result 5' },
    '6': { value: 'Result 6' },
    '7': { value: 'Result 7' },
    '8': { value: 'Result 8' },
    '9': { value: 'Result 9' },
    '10': { value: 'Result 10' },
    '11': { value: 'Result 11' },
    '12': { value: 'Result 12' },
    '13': { value: 'Result 13' },
    '14': { value: 'Result 14' },
    '15': { value: 'Result 15' },
    '16': { value: 'Result 16' },
    '17': { value: 'Result 17' },
    '18': { value: 'Result 18' },
    '19': { value: 'Result 19' },
    '20': { value: 'Result 20' },
    type: 'flat',
  },
  page: 1,
}

const mockFullTable: SURefRollTable = {
  id: 'test-full',
  source: 'Salvage Union Workshop Manual',
  name: 'Test Full',
  indexable: true,
  blackMarket: false,
  table: {
    '1': { value: 'Full Result 1' },
    '2': { value: 'Full Result 2' },
    '3': { value: 'Full Result 3' },
    '4': { value: 'Full Result 4' },
    '5': { value: 'Full Result 5' },
    '6': { value: 'Full Result 6' },
    '7': { value: 'Full Result 7' },
    '8': { value: 'Full Result 8' },
    '9': { value: 'Full Result 9' },
    '10': { value: 'Full Result 10' },
    '11': { value: 'Full Result 11' },
    '12': { value: 'Full Result 12' },
    '13': { value: 'Full Result 13' },
    '14': { value: 'Full Result 14' },
    '15': { value: 'Full Result 15' },
    '16': { value: 'Full Result 16' },
    '17': { value: 'Full Result 17' },
    '18': { value: 'Full Result 18' },
    '19': { value: 'Full Result 19' },
    '20': { value: 'Full Result 20' },
    type: 'flat',
  },
  page: 1,
}

describe('resultForTable', () => {
  describe('Error Handling', () => {
    it('should return error when tableData is undefined', () => {
      const result = resultForTable(undefined, 10)
      expect(result.success).toBe(false)
      expect(result.key).toBe('')
      if (!result.success) {
        expect(result.result.value).toContain('undefined')
      }
    })

    it('should return error when roll is below 1', () => {
      const result = resultForTable(mockStandardTable.table, 0)
      expect(result.success).toBe(false)
      expect(result.key).toBe('')
      if (!result.success) {
        expect(result.result.value).toContain('between 1 and 20')
      }
    })

    it('should return error when roll is above 20', () => {
      const result = resultForTable(mockStandardTable.table, 21)
      expect(result.success).toBe(false)
      expect(result.key).toBe('')
      if (!result.success) {
        expect(result.result.value).toContain('between 1 and 20')
      }
    })

    it('should return error when roll is negative', () => {
      const result = resultForTable(mockStandardTable.table, -5)
      expect(result.success).toBe(false)
      expect(result.key).toBe('')
      if (!result.success) {
        expect(result.result.value).toContain('between 1 and 20')
      }
    })
  })

  describe('Standard Table Type', () => {
    it('should return result for roll 1', () => {
      const result = resultForTable(mockStandardTable.table, 1)
      expect(result.success).toBe(true)
      expect(result.key).toBe('1')
      if (result.success) {
        expect(result.result.value).toBe('Critical Failure')
      }
    })

    it('should return result for roll in 2-5 range', () => {
      const result = resultForTable(mockStandardTable.table, 3)
      expect(result.success).toBe(true)
      expect(result.key).toBe('2-5')
      if (result.success) {
        expect(result.result.value).toBe('Failure')
      }
    })

    it('should return result for roll in 6-10 range', () => {
      const result = resultForTable(mockStandardTable.table, 8)
      expect(result.success).toBe(true)
      expect(result.key).toBe('6-10')
      if (result.success) {
        expect(result.result.value).toBe('Partial Success')
      }
    })

    it('should return result for roll in 11-19 range', () => {
      const result = resultForTable(mockStandardTable.table, 15)
      expect(result.success).toBe(true)
      expect(result.key).toBe('11-19')
      if (result.success) {
        expect(result.result.value).toBe('Success')
      }
    })

    it('should return result for roll 20', () => {
      const result = resultForTable(mockStandardTable.table, 20)
      expect(result.success).toBe(true)
      expect(result.key).toBe('20')
      if (result.success) {
        expect(result.result.value).toBe('Critical Success')
      }
    })
  })

  describe('Flat Table Type', () => {
    it('should return result for roll 1', () => {
      const result = resultForTable(mockFlatTable.table, 1)
      expect(result.success).toBe(true)
      expect(result.key).toBe('1')
      if (result.success) {
        expect(result.result.value).toBe('Result 1')
      }
    })

    it('should return result for roll 10', () => {
      const result = resultForTable(mockFlatTable.table, 10)
      expect(result.success).toBe(true)
      expect(result.key).toBe('10')
      if (result.success) {
        expect(result.result.value).toBe('Result 10')
      }
    })

    it('should return result for roll 20', () => {
      const result = resultForTable(mockFlatTable.table, 20)
      expect(result.success).toBe(true)
      expect(result.key).toBe('20')
      if (result.success) {
        expect(result.result.value).toBe('Result 20')
      }
    })

    it('should return correct result for each individual roll', () => {
      for (let i = 1; i <= 20; i++) {
        const result = resultForTable(mockFlatTable.table, i)
        expect(result.success).toBe(true)
        expect(result.key).toBe(i.toString())
        if (result.success) {
          expect(result.result.value).toBe(`Result ${i}`)
        }
      }
    })
  })

  describe('Full Table Type', () => {
    it('should return result for roll 1', () => {
      const result = resultForTable(mockFullTable.table, 1)
      expect(result.success).toBe(true)
      expect(result.key).toBe('1')
      if (result.success) {
        expect(result.result.value).toBe('Full Result 1')
      }
    })

    it('should return result for roll 15', () => {
      const result = resultForTable(mockFullTable.table, 15)
      expect(result.success).toBe(true)
      expect(result.key).toBe('15')
      if (result.success) {
        expect(result.result.value).toBe('Full Result 15')
      }
    })

    it('should return result for roll 20', () => {
      const result = resultForTable(mockFullTable.table, 20)
      expect(result.success).toBe(true)
      expect(result.key).toBe('20')
      if (result.success) {
        expect(result.result.value).toBe('Full Result 20')
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle boundary values correctly for standard table', () => {
      expect(resultForTable(mockStandardTable.table, 0).success).toBe(false)
      expect(resultForTable(mockStandardTable.table, 1).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 2).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 5).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 6).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 10).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 11).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 19).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 20).success).toBe(true)
      expect(resultForTable(mockStandardTable.table, 21).success).toBe(false)
    })
  })

  describe('New Format with Labels', () => {
    const mockTableWithLabels: SURefRollTable = {
      id: 'test-labels',
      source: 'Salvage Union Workshop Manual',
      name: 'Test Labels',
      indexable: true,
      blackMarket: false,
      table: {
        '1': { label: 'Critical Failure', value: 'Something terrible happens' },
        '2-5': { value: 'Failure occurs' },
        '6-10': { label: 'Partial Success', value: 'You succeed but at a cost' },
        '11-19': { value: 'Success' },
        '20': { label: 'Critical Success', value: 'Outstanding success' },
        type: 'standard',
      },
      page: 1,
    }

    it('should return label and value when both are present', () => {
      const result = resultForTable(mockTableWithLabels.table, 1)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.result.label).toBe('Critical Failure')
        expect(result.result.value).toBe('Something terrible happens')
      }
    })

    it('should return only value when label is not present', () => {
      const result = resultForTable(mockTableWithLabels.table, 3)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.result.label).toBeUndefined()
        expect(result.result.value).toBe('Failure occurs')
      }
    })

    it('should parse old string format with label separator', () => {
      // Test backward compatibility with old string format
      const mockOldFormatTable = {
        id: 'test-old',
        source: 'Salvage Union Workshop Manual' as const,
        name: 'Test Old',
        section: 'test',
        table: {
          '1': 'Label: Value with colon',
          '20': 'Just a value',
          type: 'standard',
        } as unknown as SURefObjectTable,
        page: 1,
      }

      const result1 = resultForTable(mockOldFormatTable.table, 1)
      expect(result1.success).toBe(true)
      if (result1.success) {
        expect(result1.result.label).toBe('Label')
        expect(result1.result.value).toBe('Value with colon')
      }

      const result20 = resultForTable(mockOldFormatTable.table, 20)
      expect(result20.success).toBe(true)
      if (result20.success) {
        expect(result20.result.label).toBeUndefined()
        expect(result20.result.value).toBe('Just a value')
      }
    })
  })
})
