import { useCallback, useEffect, useState } from 'react'
import PhaserGame from './components/PhaserGame'
import LobbyScreen from './components/LobbyScreen'
import AccountWidget from './components/AccountWidget'
import LoginModal from './components/LoginModal'
import LeaderboardModal from './components/LeaderboardModal'
import HomeButton from './components/HomeButton'
import useAccount from './hooks/useAccount'
import { submitScore } from './services/accountsApi'
import './App.css'

const LEVEL_KEY = 'dungeon1'
const MAP_WIDTH = 12
const MAP_HEIGHT = 8

// Faster full runs score higher, matching the shared leaderboard's
// "higher score wins" convention. The elapsed time comes from the
// server's one authoritative `complete` message, not either browser's
// own clock - see the rewrite plan's leaderboard-adaptation section.
const SCORE_CEILING = 1_000_000
function scoreFromElapsedMs(elapsedMs) {
  return Math.max(0, SCORE_CEILING - Math.round(elapsedMs / 10))
}

function formatTime(ms) {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = (totalSeconds - minutes * 60).toFixed(1)
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export default function App() {
  const [screen, setScreen] = useState('title') // title | lobby | playing | complete
  const [session, setSession] = useState(null) // { gameId, playerId, mySlot }
  const [showLogin, setShowLogin] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [finalElapsedMs, setFinalElapsedMs] = useState(null)
  const [scoreStatus, setScoreStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  // Set when "Play" was clicked while signed out - resumes straight into
  // the lobby once login completes instead of making the player click
  // Play again. Shared session cookie means this fires immediately with
  // no modal if they already signed in on another game or the dashboard.
  const [pendingPlay, setPendingPlay] = useState(false)

  const account = useAccount()

  useEffect(() => {
    if (account.isLoggedIn && pendingPlay) {
      setPendingPlay(false)
      setShowLogin(false)
      setScreen('lobby')
    }
  }, [account.isLoggedIn, pendingPlay])

  function handlePlayClick() {
    if (account.isLoggedIn) setScreen('lobby')
    else { setPendingPlay(true); setShowLogin(true) }
  }

  const handleGameStart = useCallback((gameId, playerId, isHost) => {
    setSession({ gameId, playerId, mySlot: isHost ? 1 : 2 })
    setScreen('playing')
  }, [])

  const handleComplete = useCallback((elapsedMs) => {
    setFinalElapsedMs(elapsedMs)
    setScreen('complete')
    if (account.isLoggedIn) {
      setScoreStatus('saving')
      submitScore(account.token, 'twogether', scoreFromElapsedMs(elapsedMs))
        .then(() => setScoreStatus('saved'))
        .catch(() => setScoreStatus('error'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.isLoggedIn, account.token])

  function backToTitle() {
    setSession(null)
    setFinalElapsedMs(null)
    setScoreStatus(null)
    setScreen('title')
  }

  return (
    <div className="twogether-app">
      <HomeButton />
      <AccountWidget
        isLoggedIn={account.isLoggedIn}
        isChecking={account.isChecking}
        username={account.username}
        onSignIn={() => setShowLogin(true)}
        onSignOut={account.logout}
      />

      <header className="twogether-header">
        <h1>Twogether</h1>
        {screen === 'playing' && <p className="twogether-level-name">Dungeon 1</p>}
      </header>

      {screen === 'title' && (
        <div className="twogether-panel">
          <p>
            Two players, two devices. Someone has to hold the button so the
            other can get through - then you have to figure out how to get
            them back.
          </p>
          <button className="twogether-button" onClick={handlePlayClick}>Play</button>
          <button className="twogether-secondary-button" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
        </div>
      )}

      {screen === 'lobby' && (
        <LobbyScreen playerName={account.username} onBack={() => setScreen('title')} onGameStart={handleGameStart} />
      )}

      {screen === 'playing' && session && (
        <div className="twogether-stage">
          <PhaserGame
            levelKey={LEVEL_KEY}
            mapWidth={MAP_WIDTH}
            mapHeight={MAP_HEIGHT}
            gameId={session.gameId}
            playerId={session.playerId}
            mySlot={session.mySlot}
            onComplete={handleComplete}
            onStatusChange={setConnectionStatus}
          />
          {connectionStatus === 'reconnecting' && <p className="twogether-score-status">Reconnecting...</p>}
          <button className="twogether-restart" onClick={backToTitle}>Leave Game</button>
        </div>
      )}

      {screen === 'complete' && (
        <div className="twogether-panel">
          <h2>You made it, Twogether.</h2>
          <p>Full run: {formatTime(finalElapsedMs)}</p>
          {scoreStatus === 'saving' && <p className="twogether-score-status">Saving score...</p>}
          {scoreStatus === 'saved' && <p className="twogether-score-status">Score saved to the leaderboard!</p>}
          {scoreStatus === 'error' && <p className="account-error">Could not save your score - try again later.</p>}
          {!account.isLoggedIn && <p className="twogether-score-status">Sign in to save your time to the leaderboard.</p>}
          <button className="twogether-button" onClick={backToTitle}>Play Again</button>
          <button className="twogether-secondary-button" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
        </div>
      )}

      {showLogin && (
        <LoginModal
          required={pendingPlay}
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
