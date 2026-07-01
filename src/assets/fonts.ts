// Importing the woff2 files lets Vite fingerprint them and prefix the deploy
// base path automatically — so the URLs are correct both at the site root and
// under a GitHub Pages project subpath. These same URLs feed the PNG export's
// embedded @font-face and the <link rel="preload"> we inject at startup.
import caveatUrl from './fonts/caveat-latin.woff2'
import interUrl from './fonts/inter-latin.woff2'

export const CAVEAT_URL = caveatUrl
export const INTER_URL = interUrl
