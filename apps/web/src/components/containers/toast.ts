/**
 * The app's toast call, sonner's own. The app imports it from the barrel; the
 * reference islands never do (`toastRoll` loads sonner when a roll lands), so
 * sonner stays out of the chunk they share with the app.
 */
export { toast } from 'sonner'
