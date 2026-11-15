// This game's own backend (lobby + real-time play), a different service
// from accounts-service. Always an explicit absolute URL, never a
// same-origin Vite dev proxy or a window.location.host guess - matches
// accountsApi.js's already-proven pattern, chosen deliberately over the
// window.location.host trick used elsewhere in this project family (see
// the rewrite plan's deployment section for why).
export const API_BASE_URL = import.meta.env.VITE_GAME_API_URL || 'https://api-twogether.matthewbulkley.com'

export function wsBaseUrl() {
  return API_BASE_URL.replace(/^http/, 'ws')
}
