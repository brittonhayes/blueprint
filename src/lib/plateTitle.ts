const KEY = 'blueprint-title'
export const DEFAULT_TITLE = 'Untitled plate'

export function loadTitle(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_TITLE
  } catch {
    return DEFAULT_TITLE
  }
}

export function saveTitle(title: string) {
  try {
    localStorage.setItem(KEY, title)
  } catch {
    // Storage blocked — the title just won't survive a reload.
  }
}

/** The plate title as a safe PNG filename, e.g. "Rocket Sled" → rocket-sled.png */
export function titleToFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${slug || 'blueprint'}.png`
}
