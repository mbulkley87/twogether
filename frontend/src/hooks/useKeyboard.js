import { useEffect, useRef } from 'react'

// One local player per browser now (networked multiplayer replaces the old
// same-keyboard split) - WASD and arrow keys both drive the same player,
// whichever the person on this device prefers. Window-level listeners so
// input works regardless of what has focus.
const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
}

export function useKeyboard() {
  const stateRef = useRef({ up: false, down: false, left: false, right: false })

  useEffect(() => {
    function onKeyDown(e) {
      const action = KEY_MAP[e.code]
      if (!action) return
      e.preventDefault()
      stateRef.current[action] = true
    }
    function onKeyUp(e) {
      const action = KEY_MAP[e.code]
      if (!action) return
      e.preventDefault()
      stateRef.current[action] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return stateRef
}
