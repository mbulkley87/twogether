import { useCallback, useRef, useState } from 'react'
import GameCanvas from './components/GameCanvas'
import AccountWidget from './components/AccountWidget'
import LoginModal from './components/LoginModal'
import LeaderboardModal from './components/LeaderboardModal'
import useAccount from './hooks/useAccount'
import { submitScore } from './services/accountsApi'
import { LEVELS } from './levels'
import './App.css'

// Faster full runs score higher, matching the shared leaderboard's
// "higher score wins" convention. Centisecond resolution so close runs
// still separate on the board.
const SCORE_CEILING = 1_000_000
function scoreFromElapsedMs(elapsedMs) {
  return Math.max(0, SCORE_CEILING - Math.round(elapsedMs / 10))
}

export default function App() {
  const [screen, setScreen] = useState('title') // title | playing | levelComplete | allComplete
  const [levelIndex, setLevelIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [showLogin, setShowLogin] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [finalElapsedMs, setFinalElapsedMs] = useState(null)
  const [scoreStatus, setScoreStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const runStartRef = useRef(null)

  const account = useAccount()
  const level = LEVELS[levelIndex]

  const handleComplete = useCallback(() => setScreen('levelComplete'), [])

  function startGame() {
    setLevelIndex(0)
    setAttempt((a) => a + 1)
    setScreen('playing')
    runStartRef.current = Date.now()
    setFinalElapsedMs(null)
    setScoreStatus(null)
  }

  function nextLevel() {
    if (levelIndex + 1 < LEVELS.length) {
      setLevelIndex((i) => i + 1)
      setAttempt((a) => a + 1)
      setScreen('playing')
      return
    }

    const elapsedMs = Date.now() - runStartRef.current
    setFinalElapsedMs(elapsedMs)
    setScreen('allComplete')

    if (account.isLoggedIn) {
      setScoreStatus('saving')
      submitScore(account.token, 'twogether', scoreFromElapsedMs(elapsedMs))
        .then(() => setScoreStatus('saved'))
        .catch(() => setScoreStatus('error'))
    }
  }

  function retryLevel() {
    setAttempt((a) => a + 1)
    setScreen('playing')
  }

  function formatTime(ms) {
    const totalSeconds = ms / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds - minutes * 60).toFixed(1)
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  }

  return (
    <div className="twogether-app">
      <AccountWidget
        isLoggedIn={account.isLoggedIn}
        isChecking={account.isChecking}
        username={account.username}
        onSignIn={() => setShowLogin(true)}
        onSignOut={account.logout}
      />

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
          <button className="twogether-secondary-button" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
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
          <p>Full run: {formatTime(finalElapsedMs)}</p>
          {scoreStatus === 'saving' && <p className="twogether-score-status">Saving score...</p>}
          {scoreStatus === 'saved' && <p className="twogether-score-status">Score saved to the leaderboard!</p>}
          {scoreStatus === 'error' && <p className="account-error">Could not save your score - try again later.</p>}
          {!account.isLoggedIn && <p className="twogether-score-status">Sign in to save your time to the leaderboard.</p>}
          <button className="twogether-button" onClick={startGame}>Play Again</button>
          <button className="twogether-secondary-button" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
        </div>
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLoginGuest={account.loginGuest}
          onRegisterPassword={account.registerPassword}
          onLoginPassword={account.loginPassword}
        />
      )}

      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
    </div>
  )
}
