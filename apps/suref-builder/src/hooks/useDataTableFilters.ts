import { useDataTableStore } from '../stores/dataTableStore'

export interface DataTableFilterState {
  searchTerm: string
  filters: Record<string, string>
  techLevelFilters: Set<string>
  sortField: string
  sortDirection: 'asc' | 'desc'
}

export type DataTableFilterAction =
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER'; payload: { field: string; value: string } }
  | { type: 'CLEAR_FILTER'; payload: string }
  | { type: 'SET_techLevel_FILTERS'; payload: Set<string> }
  | { type: 'TOGGLE_techLevel'; payload: string }
  | { type: 'SET_SORT'; payload: { field: string; direction: 'asc' | 'desc' } }
  | { type: 'RESET' }

/**
 * Hook for data table filter state.
 * Returns [state, dispatch] tuple for backwards compatibility.
 */
export function useDataTableFilters(): [
  DataTableFilterState,
  (action: DataTableFilterAction) => void,
] {
  const state = useDataTableStore((s) => ({
    searchTerm: s.searchTerm,
    filters: s.filters,
    techLevelFilters: s.techLevelFilters,
    sortField: s.sortField,
    sortDirection: s.sortDirection,
  }))

  const setSearch = useDataTableStore((s) => s.setSearch)
  const setFilter = useDataTableStore((s) => s.setFilter)
  const clearFilter = useDataTableStore((s) => s.clearFilter)
  const setTechLevelFilters = useDataTableStore((s) => s.setTechLevelFilters)
  const toggleTechLevel = useDataTableStore((s) => s.toggleTechLevel)
  const setSort = useDataTableStore((s) => s.setSort)
  const reset = useDataTableStore((s) => s.reset)

  const dispatch = (action: DataTableFilterAction) => {
    switch (action.type) {
      case 'SET_SEARCH':
        setSearch(action.payload)
        break
      case 'SET_FILTER':
        setFilter(action.payload.field, action.payload.value)
        break
      case 'CLEAR_FILTER':
        clearFilter(action.payload)
        break
      case 'SET_techLevel_FILTERS':
        setTechLevelFilters(action.payload)
        break
      case 'TOGGLE_techLevel':
        toggleTechLevel(action.payload)
        break
      case 'SET_SORT':
        setSort(action.payload.field, action.payload.direction)
        break
      case 'RESET':
        reset()
        break
    }
  }

  return [state, dispatch]
}
