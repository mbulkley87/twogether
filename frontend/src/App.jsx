import { useState } from 'react'
import PhaserGame from './components/PhaserGame'
import AccountWidget from './components/AccountWidget'
import LoginModal from './components/LoginModal'
import LeaderboardModal from './components/LeaderboardModal'
import useAccount from './hooks/useAccount'
import './App.css'

// Milestone 2 of the top-down/networked rewrite: prove Phaser mounts
// inside React, loads a real Tiled map, and a sprite moves + collides with
// walls. No puzzle mechanic, no networking, no level progression yet -
// those come back in the next milestones. See the plan at
// C:\Users\Admin\.claude\plans\rosy-launching-narwhal.md.
export default function App() {
  const [screen, setScreen] = useState('title') // title | playing
  const [showLogin, setShowLogin] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const account = useAccount()

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
        {screen === 'playing' && <p className="twogether-level-name">Room 1 (movement test)</p>}
      </header>

      {screen === 'title' && (
        <div className="twogether-panel">
          <p>Rebuilding as a top-down, networked co-op game. This is an early movement test.</p>
          <div className="twogether-controls">
            <div>WASD or arrow keys to move</div>
          </div>
          <button className="twogether-button" onClick={() => setScreen('playing')}>Start</button>
          <button className="twogether-secondary-button" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
        </div>
      )}

      {screen === 'playing' && (
        <div className="twogether-stage">
          <PhaserGame levelKey="room1" mapWidth={10} mapHeight={8} />
          <button className="twogether-restart" onClick={() => setScreen('title')}>Back to Title</button>
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
