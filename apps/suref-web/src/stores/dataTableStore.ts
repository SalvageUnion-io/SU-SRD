import { create } from 'zustand'

interface DataTableState {
  searchTerm: string
  filters: Record<string, string>
  techLevelFilters: Set<string>
  sortField: string
  sortDirection: 'asc' | 'desc'

  // Actions
  setSearch: (term: string) => void
  setFilter: (field: string, value: string) => void
  clearFilter: (field: string) => void
  setTechLevelFilters: (filters: Set<string>) => void
  toggleTechLevel: (level: string) => void
  setSort: (field: string, direction: 'asc' | 'desc') => void
  reset: () => void
}

const initialState = {
  searchTerm: '',
  filters: {} as Record<string, string>,
  techLevelFilters: new Set<string>(),
  sortField: 'name',
  sortDirection: 'asc' as const,
}

export const useDataTableStore = create<DataTableState>((set) => ({
  ...initialState,

  setSearch: (term) => set({ searchTerm: term }),

  setFilter: (field, value) => set((state) => ({ filters: { ...state.filters, [field]: value } })),

  clearFilter: (field) =>
    set((state) => ({
      filters: Object.fromEntries(Object.entries(state.filters).filter(([key]) => key !== field)),
    })),

  setTechLevelFilters: (filters) => set({ techLevelFilters: filters }),

  toggleTechLevel: (level) =>
    set((state) => {
      const newFilters = new Set(state.techLevelFilters)
      if (newFilters.has(level)) {
        newFilters.delete(level)
      } else {
        newFilters.add(level)
      }
      return { techLevelFilters: newFilters }
    }),

  setSort: (field, direction) => set({ sortField: field, sortDirection: direction }),

  reset: () => set(initialState),
}))
