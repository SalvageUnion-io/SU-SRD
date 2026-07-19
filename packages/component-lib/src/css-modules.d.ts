// Ambient declaration so the co-located `.css` side-effect imports in these
// legacy "before" captures typecheck. Vite/Ladle handles the actual CSS loading.
declare module '*.css'
