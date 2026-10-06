// The previews import root prose as text: `config.json`'s `storyImports.loaders`
// maps `.md` to Bun's text loader, so the default export is the file's contents.
declare module '*.md' {
  const text: string
  export default text
}
