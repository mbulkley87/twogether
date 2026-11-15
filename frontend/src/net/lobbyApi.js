import { API_BASE_URL } from './gameApiBase'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api${path}`, options)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Lobby request failed: ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}

export function createLobby(playerName, isPublic) {
  return request(`/lobbies?playerName=${encodeURIComponent(playerName)}&isPublic=${isPublic}`, { method: 'POST' })
}

export function listPublicLobbies() {
  return request('/lobbies/public')
}

export function joinLobby(code, playerName) {
  return request(`/lobbies/${encodeURIComponent(code)}/join?playerName=${encodeURIComponent(playerName)}`, {
    method: 'POST',
  })
}

export function getLobby(code) {
  return request(`/lobbies/${encodeURIComponent(code)}`)
}

export function leaveLobby(code, playerId) {
  return request(`/lobbies/${encodeURIComponent(code)}/leave?playerId=${encodeURIComponent(playerId)}`, {
    method: 'POST',
  })
}

export function startGame(code, playerId) {
  return request(`/lobbies/${encodeURIComponent(code)}/start?playerId=${encodeURIComponent(playerId)}`, {
    method: 'POST',
  })
}
