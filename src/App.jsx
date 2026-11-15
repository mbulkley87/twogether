import { useCallback, useState } from 'react'
import GameCanvas from './components/GameCanvas'
import { LEVELS } from './levels'
import './App.css'

export default function App() {
  const [screen, setScreen] = useState('title') // title | playing | levelComplete | allComplete
  const [levelIndex, setLevelIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)

  const level = LEVELS[levelIndex]

  const handleComplete = useCallback(() => setScreen('levelComplete'), [])

  function startGame() {
    setLevelIndex(0)
    setAttempt((a) => a + 1)
    setScreen('playing')
  }

  function nextLevel() {
    if (levelIndex + 1 < LEVELS.length) {
      setLevelIndex((i) => i + 1)
      setAttempt((a) => a + 1)
      setScreen('playing')
    } else {
      setScreen('allComplete')
    }
  }

  function retryLevel() {
    setAttempt((a) => a + 1)
    setScreen('playing')
  }

  return (
    <div className="twogether-app">
      <header className="twogether-header">
        <h1>Twogether</h1>
        {screen === 'playing' && <p className="twogether-level-name">{level.name}</p>}
      </header>

      {screen === 'title' && (
        <div className="twogether-panel">
          <p>
            Two players, one keyboard. Someone has to hold the button so the
            other can get through - then you have to figure out how to get
            them back.
          </p>
          <div className="twogether-controls">
            <div><strong className="p1-label">Player 1</strong>: A / D to move, W to jump</div>
            <div><strong className="p2-label">Player 2</strong>: Arrow keys to move, Up to jump</div>
          </div>
          <button className="twogether-button" onClick={startGame}>Start</button>
        </div>
      )}

      {screen === 'playing' && (
        <div className="twogether-stage">
          <GameCanvas key={`${levelIndex}-${attempt}`} level={level} onComplete={handleComplete} />
          <button className="twogether-restart" onClick={retryLevel}>Restart Level</button>
        </div>
      )}

      {screen === 'levelComplete' && (
        <div className="twogether-panel">
          <h2>Level Complete!</h2>
          <button className="twogether-button" onClick={nextLevel}>
            {levelIndex + 1 < LEVELS.length ? 'Next Level' : 'Finish'}
          </button>
        </div>
      )}

      {screen === 'allComplete' && (
        <div className="twogether-panel">
          <h2>You made it, Twogether.</h2>
          <button className="twogether-button" onClick={startGame}>Play Again</button>
        </div>
      )}
    </div>
  )
}
