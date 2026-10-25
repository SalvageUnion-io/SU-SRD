import { GAME_ROOM_TABLES } from './game/schema'
import type { Migrations } from './migrate'

/** A player's shelf (ADR-064 §1). Append a step; never edit a shipped one. */
export const ACCOUNT_ROOM: Migrations = []

/** A Game and its live table (ADR-064 §2). Append a step; never edit a shipped one. */
export const GAME_ROOM: Migrations = [GAME_ROOM_TABLES]
