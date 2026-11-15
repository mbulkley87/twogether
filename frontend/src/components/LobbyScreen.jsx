import { useEffect, useRef, useState } from 'react'
import { createLobby, joinLobby, getLobby, leaveLobby, startGame } from '../net/lobbyApi'
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
function LobbyScreen({ onBack, onGameStart }) {
  const [step, setStep] = useState('entry')
  const [playerName, setPlayerName] = useState('')
  const [joinCode, setJoinCode] = useState('')
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
      const result = await createLobby(playerName.trim())
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

  async function handleJoinSubmit() {
    if (!playerName.trim() || !joinCode.trim() || submitting) return
    setSubmitting(true)
    setLocalError(null)
    try {
      const trimmedCode = joinCode.trim().toUpperCase()
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
          Join Code <strong>{lobby.code}</strong>
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
        <input
          className="account-username-input"
          type="text"
          placeholder="Join Code"
          value={joinCode}
          maxLength={5}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
        />
        <button className="twogether-button" onClick={handleJoinSubmit} disabled={submitting || !joinCode.trim()}>Join</button>
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
      <button className="twogether-button" onClick={handleCreate} disabled={submitting || !playerName.trim()}>Create Lobby</button>
      <button className="twogether-secondary-button" onClick={() => setStep('joining')} disabled={!playerName.trim()}>Join Lobby</button>
      <button className="twogether-secondary-button" onClick={onBack}>Back</button>
      {localError && <p className="account-error">{localError}</p>}
    </div>
  )
}

export default LobbyScreen
