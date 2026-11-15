import { wsBaseUrl } from './gameApiBase'

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 8000]
const MOVE_SEND_INTERVAL_MS = 66 // ~15Hz - see the rewrite plan for why this rate

/**
 * The real-time gameplay socket. Unlike lobbySocket (server-to-client
 * only), this one sends too: the local player's position goes out at a
 * throttled rate regardless of how often the caller calls sendMove(), and
 * the server relays it to the other player immediately while separately
 * computing the authoritative puzzle state. See GameSessionService.java
 * for the full reasoning behind that split - the short version is: never
 * trust openDoors/completed from anywhere but an incoming `state`/
 * `complete` message, never compute it locally from peer data.
 */
export function connectGameSocket({ gameId, playerId, onPeerMove, onState, onComplete, onStatusChange }) {
  let socket = null
  let intentionalClose = false
  let reconnectAttempt = 0
  let reconnectTimer = null
  let seq = 0
  let lastSendAt = 0

  function open() {
    onStatusChange?.(reconnectAttempt > 0 ? 'reconnecting' : 'connecting')
    socket = new WebSocket(`${wsBaseUrl()}/ws/game/${encodeURIComponent(gameId)}?playerId=${encodeURIComponent(playerId)}`)

    socket.onopen = () => {
      reconnectAttempt = 0
      onStatusChange?.('open')
    }

    socket.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message.type === 'peerMove') onPeerMove?.(message)
      else if (message.type === 'state') onState?.(message)
      else if (message.type === 'complete') onComplete?.(message)
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
    // Safe to call every frame - internally throttled to MOVE_SEND_INTERVAL_MS.
    sendMove(x, y, dir, moving) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      const now = performance.now()
      if (now - lastSendAt < MOVE_SEND_INTERVAL_MS) return
      lastSendAt = now
      seq += 1
      socket.send(JSON.stringify({ type: 'move', seq, x, y, dir, moving }))
    },
    close() {
      intentionalClose = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      socket?.close()
    },
  }
}
