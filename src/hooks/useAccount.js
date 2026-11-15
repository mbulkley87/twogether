import { useCallback, useEffect, useState } from 'react'
import { loginAsGuest, registerWithPassword, loginWithPassword, fetchCurrentUser } from '../services/accountsApi'

// Shared across every subdomain of matthewbulkley.com via a cookie scoped
// to the parent domain, instead of a per-app localStorage key - logging in
// once on any game or the main dashboard now carries over to all the
// others, since localStorage is isolated per origin but a cookie with
// Domain=.matthewbulkley.com is readable by every subdomain's JS.
const SESSION_COOKIE = 'mb_account_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 35 // 35 days - longer than the 30-day token lifetime

function cookieDomainAttr() {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' ? '' : '; domain=.matthewbulkley.com'
}

function readStoredSession() {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`))
    return match ? JSON.parse(decodeURIComponent(match[1])) : null
  } catch {
    return null
  }
}

function writeStoredSession(session) {
  try {
    const secureAttr = window.location.protocol === 'https:' ? '; secure' : ''
    if (session) {
      document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=${SESSION_MAX_AGE}${cookieDomainAttr()}${secureAttr}; samesite=lax`
    } else {
      document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0${cookieDomainAttr()}`
    }
  } catch {
    // Private browsing / cookies disabled - harmless degradation, just can't persist.
  }
}

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
