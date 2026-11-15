import { useCallback, useRef } from 'react'

const DEADZONE_PX = 10 // thumb movement before any direction registers
const MAX_RADIUS_PX = 40 // how far the visual thumb can travel from center

/**
 * A virtual joystick: a ref holding {up,down,left,right} in the exact same
 * shape useKeyboard() produces, fed from pointer events instead of key
 * events, so GameScene can treat both input sources identically. Thumb
 * position for rendering is reported back from onPointerMove rather than
 * stored in React state - this fires on every touchmove, and state
 * updates at that frequency would cause needless re-renders.
 */
export function useTouchJoystick() {
  const stateRef = useRef({ up: false, down: false, left: false, right: false })
  const activePointerId = useRef(null)
  const originRef = useRef({ x: 0, y: 0 })

  const reset = useCallback(() => {
    stateRef.current = { up: false, down: false, left: false, right: false }
  }, [])

  const onPointerDown = useCallback((event) => {
    activePointerId.current = event.pointerId
    originRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    return { dx: 0, dy: 0 }
  }, [])

  const onPointerMove = useCallback((event) => {
    if (event.pointerId !== activePointerId.current) return null
    const dx = event.clientX - originRef.current.x
    const dy = event.clientY - originRef.current.y
    stateRef.current = {
      left: dx < -DEADZONE_PX,
      right: dx > DEADZONE_PX,
      up: dy < -DEADZONE_PX,
      down: dy > DEADZONE_PX,
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

  return { stateRef, onPointerDown, onPointerMove, onPointerUp }
}
