import { wsBaseUrl } from './gameApiBase'

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 8000]

/**
 * Wraps the native WebSocket in a small reconnect-with-backoff shell, same
 * pattern as Hero Details' lobbySocket.js - no client library, the backend
 * is a raw TextWebSocketHandler. Unlike that version, the URL is built
 * from an explicit base, not window.location.host.
 */
export function connectLobbySocket({ code, playerId, onMessage, onStatusChange }) {
  let socket = null
  let intentionalClose = false
  let reconnectAttempt = 0
  let reconnectTimer = null

  function open() {
    onStatusChange?.(reconnectAttempt > 0 ? 'reconnecting' : 'connecting')
    socket = new WebSocket(`${wsBaseUrl()}/ws/lobby/${encodeURIComponent(code)}?playerId=${encodeURIComponent(playerId)}`)

    socket.onopen = () => {
      reconnectAttempt = 0
      onStatusChange?.('open')
    }

    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data))
      } catch {
        // Ignore malformed frames rather than tearing down the connection.
      }
    }

    socket.onclose = () => {
      if (intentionalClose) {
        onStatusChange?.('closed')
        return
      }
      onStatusChange?.('reconnecting')
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
      reconnectAttempt += 1
      reconnectTimer = window.setTimeout(open, delay)
    }

    socket.onerror = () => {
      socket?.close()
    }
  }

  open()

  return {
    close() {
      intentionalClose = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      socket?.close()
    },
  }
}
