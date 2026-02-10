import type { ControlBarConfig } from './LiveSheetControlBar'

/**
 * Configuration for Pilot LiveSheet control bar.
 * Shows crawler selector and link to crawler.
 */
export const PILOT_CONTROL_BAR_CONFIG: ControlBarConfig = {
  table: 'crawlers',
  selectFields: 'id, name, game_id',
  nameField: 'name',
  label: 'Crawler',
  backgroundColor: 'bg.builder.pilot',
  linkLabel: '→ Crawler',
  linkPath: (id) => `/dashboard/crawlers/${id}`,
}

/**
 * Configuration for Mech LiveSheet control bar.
 * Shows pilot selector and link to pilot.
 */
export const MECH_CONTROL_BAR_CONFIG: ControlBarConfig = {
  table: 'pilots',
  selectFields: 'id, callsign',
  nameField: 'callsign',
  label: 'Pilot',
  backgroundColor: 'bg.builder.mech',
  linkLabel: '→ Pilot',
  linkPath: (id) => `/dashboard/pilots/${id}`,
}
