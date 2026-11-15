import { useRef } from 'react'

/**
 * A full-coverage touch zone over the game canvas - touching anywhere
 * makes a glowing joystick appear centered AT that exact point and track
 * movement from there (a "floating" joystick, the standard mobile-game
 * feel), rather than a small fixed circle in one corner that has to be
 * found and hit precisely. The thumb's visual position is pushed
 * directly to the DOM via a ref during drag, not React state, to avoid
 * a re-render on every pointermove; only the base's origin (set once per
 * press) is React state, from useTouchJoystick.
 */
export default function TouchControls({ origin, onPointerDown, onPointerMove, onPointerUp }) {
  const thumbRef = useRef(null)

  function handleMove(event) {
    const result = onPointerMove(event)
    if (result && thumbRef.current) {
      thumbRef.current.style.transform = `translate(${result.dx}px, ${result.dy}px)`
    }
  }

  function handleUp(event) {
    onPointerUp(event)
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(0, 0)'
  }

  return (
    <div
      className="twogether-touch-zone"
      onPointerDown={onPointerDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {origin && (
        <div className="twogether-joystick-base" style={{ left: origin.x, top: origin.y }}>
          <div ref={thumbRef} className="twogether-joystick-thumb" />
        </div>
      )}
    </div>
  )
}
