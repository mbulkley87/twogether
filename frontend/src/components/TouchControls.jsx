import { useRef } from 'react'

/**
 * A translucent on-screen joystick overlay, shown only on coarse-pointer
 * (touch) devices - see the `(pointer: coarse)` check in PhaserGame.jsx.
 * The thumb's visual position is pushed directly to the DOM via a ref,
 * not React state, to avoid a re-render on every pointermove.
 */
export default function TouchControls({ onPointerDown, onPointerMove, onPointerUp }) {
  const thumbRef = useRef(null)

  function handleDown(event) {
    onPointerDown(event)
  }

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
      className="twogether-joystick-base"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <div ref={thumbRef} className="twogether-joystick-thumb" />
    </div>
  )
}
