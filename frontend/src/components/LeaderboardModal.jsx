import { useEffect, useState } from 'react'
import { fetchLeaderboard } from '../services/accountsApi'

function LeaderboardModal({ onClose }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchLeaderboard('twogether', 20)
      .then((data) => { if (!cancelled) setEntries(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load the leaderboard.') })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="account-backdrop" onClick={onClose}>
      <section className="account-modal leaderboard-modal" onClick={(event) => event.stopPropagation()}>
        <button className="account-modal-close" onClick={onClose}>✕</button>
        <div className="account-modal-kicker">TWOGETHER</div>
        <h2>🏆 Leaderboard</h2>
        <p className="leaderboard-hint">Fastest full run (all levels) wins.</p>

        {error && <p className="account-error">{error}</p>}
        {!error && entries === null && <p>Loading...</p>}
        {!error && entries?.length === 0 && <p>No runs yet - be the first!</p>}
        {!error && entries?.length > 0 && (
          <ol className="leaderboard-list">
            {entries.map((entry, index) => (
              <li key={entry.userId} className="leaderboard-row">
                <span className="leaderboard-rank">#{index + 1}</span>
                <span className="leaderboard-name">{entry.username}</span>
                <span className="leaderboard-score">{entry.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

export default LeaderboardModal
