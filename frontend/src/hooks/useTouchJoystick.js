import { useCallback, useRef, useState } from 'react'

const DEADZONE_PX = 10 // thumb movement before any direction registers
const MAX_RADIUS_PX = 48 // how far the visual thumb can travel from center

function dirKey(state) {
  return `${state.up ? 'u' : ''}${state.down ? 'd' : ''}${state.left ? 'l' : ''}${state.right ? 'r' : ''}`
}

/**
 * A floating virtual joystick: touching anywhere in its zone makes the
 * joystick appear centered AT that point (classic mobile-game feel,
 * rather than a small fixed-position circle you have to find and hit
 * precisely) and tracks movement from there. Exposes {up,down,left,right}
 * in the exact same shape useKeyboard() produces, fed from pointer events
 * instead of key events, so GameScene treats both input sources
 * identically. `origin` (React state - only changes on press/release, not
 * every move) is what positions the floating base/thumb; thumb offset
 * during drag is reported back from onPointerMove directly rather than
 * stored in state, since that fires continuously and would cause needless
 * re-renders at that frequency.
 */
export function useTouchJoystick() {
  const stateRef = useRef({ up: false, down: false, left: false, right: false })
  const activePointerId = useRef(null)
  const originPoint = useRef({ x: 0, y: 0 })
  const lastDirKey = useRef('')
  const [origin, setOrigin] = useState(null) // {x, y} in zone-local coords, or null when not touching

  const reset = useCallback(() => {
    stateRef.current = { up: false, down: false, left: false, right: false }
    lastDirKey.current = ''
    setOrigin(null)
  }, [])

  const onPointerDown = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    activePointerId.current = event.pointerId
    originPoint.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setOrigin({ x, y })
    try { navigator.vibrate?.(8) } catch { /* not supported - harmless */ }
  }, [])

  const onPointerMove = useCallback((event) => {
    if (event.pointerId !== activePointerId.current) return null
    const dx = event.clientX - originPoint.current.x
    const dy = event.clientY - originPoint.current.y
    const next = {
      left: dx < -DEADZONE_PX,
      right: dx > DEADZONE_PX,
      up: dy < -DEADZONE_PX,
      down: dy > DEADZONE_PX,
    }
    stateRef.current = next
    const key = dirKey(next)
    if (key !== lastDirKey.current) {
      lastDirKey.current = key
      try { navigator.vibrate?.(key ? 6 : 0) } catch { /* not supported - harmless */ }
    }
    const clampedDx = Math.max(-MAX_RADIUS_PX, Math.min(MAX_RADIUS_PX, dx))
    const clampedDy = Math.max(-MAX_RADIUS_PX, Math.min(MAX_RADIUS_PX, dy))
    return { dx: clampedDx, dy: clampedDy }
  }, [])

  const onPointerUp = useCallback((event) => {
    if (event.pointerId !== activePointerId.current) return
    activePointerId.current = null
    reset()
  }, [reset])

  return { stateRef, origin, onPointerDown, onPointerMove, onPointerUp }
}
