// Vite resolves these imports to fingerprinted, base-prefixed URL strings.
declare module '*.woff2' {
  const url: string
  export default url
}
