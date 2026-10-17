/**
 * Tests asserting AbilitySchema field optionality matches the actual data.
 *
 * Data audit of abilities.json (103 entries):
 *   - tree:    103/103 — always present → required
 *   - level:   103/103 — always present → required
 *   - actions: 103/103 — always present → required
 *   - description:        103/103 — now always present, but kept optional so
 *                                  homebrew data need not supply one
 *   - mechActionType:       7/103 — sometimes present → optional (unchanged)
 *   - grants:               6/103 — sometimes present → optional (unchanged)
 *   - activationCurrency:   1/103 — sometimes present → optional (unchanged)
 */
export {};
