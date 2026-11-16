import { useEffect, useRef, useState } from 'react'
import { createLobby, joinLobby, getLobby, leaveLobby, startGame, listPublicLobbies } from '../net/lobbyApi'
import { connectLobbySocket } from '../net/lobbySocket'

const SESSION_KEY = 'twogether-lobby-session'

function readSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function writeSession(session) {
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(SESSION_KEY)
  }
}

// Ported from Hero Details' LobbyScreen - same join-code/waiting-room/
// reconnect-on-refresh shell, with the class picker removed since there's
// nothing to pick here. "Ready" collapses to "both seats are filled."
// The host decides private-vs-public at creation; joining offers both a
// code field (the default, works for any lobby) and a live list of open
// public lobbies to join with one click, no code needed.
function LobbyScreen({ onBack, onGameStart }) {
  const [step, setStep] = useState('entry')
  const [playerName, setPlayerName] = useState('')
  const [isPublicCreate, setIsPublicCreate] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [showCodeEntry, setShowCodeEntry] = useState(false)
  const [publicLobbies, setPublicLobbies] = useState(null)
  const [publicLobbiesError, setPublicLobbiesError] = useState(null)
  const [lobby, setLobby] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [code, setCode] = useState(null)
  const [wsStatus, setWsStatus] = useState('connecting')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)
  const socketRef = useRef(null)
  const gameStartedRef = useRef(false)

  useEffect(() => {
    return () => socketRef.current?.close()
  }, [])

  // Fires for every member, not just whoever clicked Start - the host's
  // click sets lobby.gameId via the POST response, and the other player
  // learns about it the same way they learn everything else about this
  // lobby: the live WebSocket broadcast updating `lobby` out from under them.
  useEffect(() => {
    if (!lobby?.gameId || !playerId || gameStartedRef.current) return
    gameStartedRef.current = true
    socketRef.current?.close()
    socketRef.current = null
    writeSession(null)
    const hostMember = lobby.members.find((member) => member.playerId === playerId)
    onGameStart(lobby.gameId, playerId, Boolean(hostMember?.host))
  }, [lobby?.gameId, playerId, onGameStart, lobby?.members])

  useEffect(() => {
    const saved = readSession()
    if (!saved?.lobbyCode || !saved?.playerId) return

    let cancelled = false
    ;(async () => {
      try {
        const savedLobby = await getLobby(saved.lobbyCode)
        const stillMember = savedLobby.members.some((member) => member.playerId === saved.playerId)
        if (!stillMember || cancelled) {
          if (!stillMember) writeSession(null)
          return
        }
        setPlayerName(saved.playerName)
        setCode(saved.lobbyCode)
        setPlayerId(saved.playerId)
        setLobby(savedLobby)
        setStep('waiting')
        connectSocket(saved.lobbyCode, saved.playerId)
      } catch {
        writeSession(null)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function connectSocket(lobbyCode, forPlayerId) {
    socketRef.current?.close()
    socketRef.current = connectLobbySocket({
      code: lobbyCode,
      playerId: forPlayerId,
      onMessage: setLobby,
      onStatusChange: setWsStatus,
    })
  }

  async function handleCreate() {
    if (!playerName.trim() || submitting) return
    setSubmitting(true)
    setLocalError(null)
    try {
      const result = await createLobby(playerName.trim(), isPublicCreate)
      writeSession({ playerName: playerName.trim(), lobbyCode: result.lobby.code, playerId: result.playerId })
      setCode(result.lobby.code)
      setPlayerId(result.playerId)
      setLobby(result.lobby)
      setStep('waiting')
      connectSocket(result.lobby.code, result.playerId)
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function joinByCode(trimmedCode) {
    if (!playerName.trim() || submitting) return
    setSubmitting(true)
    setLocalError(null)
    try {
      const result = await joinLobby(trimmedCode, playerName.trim())
      writeSession({ playerName: playerName.trim(), lobbyCode: result.lobby.code, playerId: result.playerId })
      setCode(result.lobby.code)
      setPlayerId(result.playerId)
      setLobby(result.lobby)
      setStep('waiting')
      connectSocket(result.lobby.code, result.playerId)
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleJoinSubmit() {
    if (!joinCode.trim()) return
    joinByCode(joinCode.trim().toUpperCase())
  }

  async function refreshPublicLobbies() {
    setPublicLobbiesError(null)
    try {
      const list = await listPublicLobbies()
      setPublicLobbies(list)
    } catch (err) {
      setPublicLobbiesError(err.message)
    }
  }

  function openJoinScreen() {
    setStep('joining')
    setShowCodeEntry(false)
    setPublicLobbies(null)
    refreshPublicLobbies()
  }

  async function handleStart() {
    if (!code || !playerId || submitting) return
    setSubmitting(true)
    setLocalError(null)
    try {
      const updated = await startGame(code, playerId)
      setLobby(updated)
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLeave() {
    socketRef.current?.close()
    socketRef.current = null
    writeSession(null)
    if (code && playerId) {
      try {
        await leaveLobby(code, playerId)
      } catch {
        // Best effort - the lobby's TTL sweep will clean this up regardless.
      }
    }
    setLobby(null)
    setPlayerId(null)
    setCode(null)
    setJoinCode('')
    setStep('entry')
  }

  const self = lobby?.members.find((member) => member.playerId === playerId)
  const isHost = Boolean(self?.host)
  const ready = lobby?.members.length === 2

  if (step === 'waiting' && lobby) {
    return (
      <div className="twogether-panel">
        <div className="lobby-code-display">
          {lobby.public ? 'Public Game' : 'Private Game'} <strong>{lobby.code}</strong>
        </div>

        <ul className="lobby-roster">
          {lobby.members.map((member) => (
            <li key={member.playerId} className={member.connected ? 'lobby-member' : 'lobby-member lobby-member-disconnected'}>
              <span>{member.playerName}</span>
              {member.host && <span className="lobby-badge">Host</span>}
              <span className={member.connected ? 'lobby-status-connected' : 'lobby-status-disconnected'}>
                {member.connected ? 'Connected' : 'Disconnected'}
              </span>
            </li>
          ))}
        </ul>

        <button className="twogether-button" disabled={!isHost || submitting || !ready} onClick={handleStart}>
          Start Game
        </button>
        <p className="twogether-score-status">
          {isHost ? (ready ? 'Ready to start' : 'Waiting for a second player to join') : 'Waiting for the host to start'}
        </p>
        {wsStatus === 'reconnecting' && <p className="twogether-score-status">Reconnecting...</p>}
        {localError && <p className="account-error">{localError}</p>}

        <button className="twogether-secondary-button" onClick={handleLeave}>Leave Lobby</button>
      </div>
    )
  }

  if (step === 'joining') {
    return (
      <div className="twogether-panel">
        <div className="lobby-join-section">
          <div className="lobby-join-heading-row">
            <h3 className="lobby-join-heading">Public Games</h3>
            <button className="lobby-refresh-button" onClick={refreshPublicLobbies} disabled={submitting}>Refresh</button>
          </div>
          <p className="twogether-score-status">Pick a game below to join instantly. No code needed.</p>
          {publicLobbiesError && <p className="account-error">{publicLobbiesError}</p>}
          {!publicLobbiesError && publicLobbies === null && <p className="twogether-score-status">Loading...</p>}
          {!publicLobbiesError && publicLobbies?.length === 0 && <p className="twogether-score-status">No public games open right now.</p>}
          {!publicLobbiesError && publicLobbies?.length > 0 && (
            <ul className="lobby-public-list">
              {publicLobbies.map((publicLobby) => (
                <li key={publicLobby.code} className="lobby-public-row">
                  <span className="lobby-public-host">{publicLobby.members[0]?.playerName ?? 'Someone'}'s game</span>
                  <span className="lobby-public-count">{publicLobby.members.length}/2</span>
                  <button
                    className="lobby-public-join-button"
                    disabled={submitting}
                    onClick={() => joinByCode(publicLobby.code)}
                  >
                    Join
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lobby-join-section">
          {!showCodeEntry && (
            <button className="lobby-code-toggle" onClick={() => setShowCodeEntry(true)}>Have a private game code?</button>
          )}
          {showCodeEntry && (
            <>
              <h3 className="lobby-join-heading">Private Game</h3>
              <input
                className="account-username-input"
                type="text"
                placeholder="Join Code"
                value={joinCode}
                maxLength={5}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              />
              <button className="twogether-button" onClick={handleJoinSubmit} disabled={submitting || !joinCode.trim()}>Join with Code</button>
            </>
          )}
        </div>

        <button className="twogether-secondary-button" onClick={() => setStep('entry')}>Back</button>
        {localError && <p className="account-error">{localError}</p>}
      </div>
    )
  }

  return (
    <div className="twogether-panel">
      <input
        className="account-username-input"
        type="text"
        placeholder="Your name"
        value={playerName}
        maxLength={24}
        onChange={(event) => setPlayerName(event.target.value)}
      />
      <div className="lobby-visibility-switch">
        <button
          type="button"
          className={!isPublicCreate ? 'active' : ''}
          onClick={() => setIsPublicCreate(false)}
        >
          Private
        </button>
        <button
          type="button"
          className={isPublicCreate ? 'active' : ''}
          onClick={() => setIsPublicCreate(true)}
        >
          Public
        </button>
      </div>
      <p className="twogether-score-status">
        {isPublicCreate ? 'Anyone can find and join from the public games list.' : 'Only someone with your join code can get in.'}
      </p>
      <button className="twogether-button" onClick={handleCreate} disabled={submitting || !playerName.trim()}>Create Lobby</button>
      <button className="twogether-secondary-button" onClick={openJoinScreen} disabled={!playerName.trim()}>Join Lobby</button>
      <button className="twogether-secondary-button" onClick={onBack}>Back</button>
      {localError && <p className="account-error">{localError}</p>}
    </div>
  )
}

export default LobbyScreen
