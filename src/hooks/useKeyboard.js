import { useEffect, useRef } from 'react'

// Player 1: WASD. Player 2: arrow keys. Window-level listeners so input
// works regardless of what has focus - no canvas tabindex juggling.
const KEY_MAP = {
  KeyA: 'p1-left',
  KeyD: 'p1-right',
  KeyW: 'p1-jump',
  ArrowLeft: 'p2-left',
  ArrowRight: 'p2-right',
  ArrowUp: 'p2-jump',
}

export function useKeyboard() {
  const stateRef = useRef({
    p1: { left: false, right: false, jump: false },
    p2: { left: false, right: false, jump: false },
  })

  useEffect(() => {
    function setAction(action, pressed) {
      const [player, key] = action.split('-')
      stateRef.current[player][key] = pressed
    }
    function onKeyDown(e) {
      const action = KEY_MAP[e.code]
      if (!action) return
      e.preventDefault()
      setAction(action, true)
    }
    function onKeyUp(e) {
      const action = KEY_MAP[e.code]
      if (!action) return
      e.preventDefault()
      setAction(action, false)
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
