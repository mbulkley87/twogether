import { useCallback, useEffect, useState } from 'react'
import { loginAsGuest, registerWithPassword, loginWithPassword, fetchCurrentUser } from '../services/accountsApi'

const STORAGE_KEY = 'twogether-account-session'

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStoredSession(session) {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Private browsing / storage disabled / quota exceeded - harmless degradation, just can't persist.
  }
}

// Same shared-identity pattern as ClueTations/Hero Details' useAccount -
// see accounts-service-architecture memory for why each game keeps its own
// separate stored session even though they share one identity backend.
// Never blocks gameplay: purely additive, just for leaderboard credit.
function useAccount() {
  const [session, setSession] = useState(readStoredSession)
  const [checking, setChecking] = useState(Boolean(session))

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetchCurrentUser(session.token)
      .then((user) => {
        if (!cancelled) setSession((current) => (current ? { ...current, username: user.username } : current))
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null)
          writeStoredSession(null)
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  function applySession(result) {
    const next = { token: result.token, userId: result.userId, username: result.username }
    setSession(next)
    writeStoredSession(next)
    return next
  }

  const loginGuest = useCallback(async (username) => applySession(await loginAsGuest(username)), [])
  const registerPassword = useCallback(async (username, password) => applySession(await registerWithPassword(username, password)), [])
  const loginPassword = useCallback(async (username, password) => applySession(await loginWithPassword(username, password)), [])

  const logout = useCallback(() => {
    setSession(null)
    writeStoredSession(null)
  }, [])

  return {
    isLoggedIn: Boolean(session),
    isChecking: checking,
    username: session?.username ?? null,
    token: session?.token ?? null,
    loginGuest,
    registerPassword,
    loginPassword,
    logout,
  }
}

export default useAccount
