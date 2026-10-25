/** Where the Worker answers for the rooms; `astro/build/devRooms.ts` proxies it in dev. */
export const ROOMS_PATH = '/__rooms'

/** `GET`: each room kind opens and migrates, or the answer is a 503. */
export const ROOMS_HEALTH_PATH = `${ROOMS_PATH}/health`
