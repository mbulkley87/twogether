export const TILE_SIZE = 40
export const PLAYER_WIDTH = 26
export const PLAYER_HEIGHT = 34

const GRAVITY = 2200 // px/s^2
const MOVE_SPEED = 220 // px/s
const JUMP_VELOCITY = -680 // px/s
const MAX_FALL_SPEED = 900 // px/s

export function createPlayer(spawnTile, color) {
  return {
    x: spawnTile.x * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) / 2,
    y: spawnTile.y * TILE_SIZE + (TILE_SIZE - PLAYER_HEIGHT),
    vx: 0,
    vy: 0,
    onGround: false,
    color,
  }
}

// Doors are closed (solid) by default - open only while a plate that shares
// their letter has a player standing on it. See level.js for the format.
function isSolidTile(level, openDoors, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return true
  const key = `${tx},${ty}`
  if (level.solid.has(key)) return true
  for (const letter of Object.keys(level.doors)) {
    if (openDoors.has(letter)) continue
    if (level.doors[letter].some((t) => t.x === tx && t.y === ty)) return true
  }
  return false
}

function resolveAxis(player, level, openDoors, axis, delta) {
  if (delta === 0) return
  const left = Math.floor(player.x / TILE_SIZE)
  const right = Math.floor((player.x + PLAYER_WIDTH - 1) / TILE_SIZE)
  const top = Math.floor(player.y / TILE_SIZE)
  const bottom = Math.floor((player.y + PLAYER_HEIGHT - 1) / TILE_SIZE)

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (!isSolidTile(level, openDoors, tx, ty)) continue
      if (axis === 'x') {
        if (delta > 0) player.x = tx * TILE_SIZE - PLAYER_WIDTH
        else player.x = (tx + 1) * TILE_SIZE
        player.vx = 0
      } else {
        if (delta > 0) {
          player.y = ty * TILE_SIZE - PLAYER_HEIGHT
          player.onGround = true
        } else {
          player.y = (ty + 1) * TILE_SIZE
        }
        player.vy = 0
      }
    }
  }
}

/** input: { left, right, jump } booleans. Mutates player in place. */
export function stepPlayer(player, input, level, openDoors, dt) {
  player.vx = input.left ? -MOVE_SPEED : input.right ? MOVE_SPEED : 0
  if (input.jump && player.onGround) {
    player.vy = JUMP_VELOCITY
  }

  player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED)
  player.onGround = false

  const dx = player.vx * dt
  player.x += dx
  resolveAxis(player, level, openDoors, 'x', dx)

  const dy = player.vy * dt
  player.y += dy
  resolveAxis(player, level, openDoors, 'y', dy)

  // The collision correction above snaps the player flush against the
  // floor, but gravity needs another couple of ticks to re-accumulate
  // enough fall speed to detect that same collision again - leaving
  // onGround flickering false every other tick while genuinely at rest.
  // Probe one pixel below the feet directly instead of relying on an
  // actual collision happening this exact tick.
  if (!player.onGround && player.vy >= 0) {
    const left = Math.floor(player.x / TILE_SIZE)
    const right = Math.floor((player.x + PLAYER_WIDTH - 1) / TILE_SIZE)
    const feetRow = Math.floor((player.y + PLAYER_HEIGHT) / TILE_SIZE)
    for (let tx = left; tx <= right; tx++) {
      if (isSolidTile(level, openDoors, tx, feetRow)) {
        player.onGround = true
        break
      }
    }
  }
}

export function overlapsTile(player, tile) {
  if (!tile) return false
  const tx1 = tile.x * TILE_SIZE
  const ty1 = tile.y * TILE_SIZE
  return (
    player.x < tx1 + TILE_SIZE &&
    player.x + PLAYER_WIDTH > tx1 &&
    player.y < ty1 + TILE_SIZE &&
    player.y + PLAYER_HEIGHT > ty1
  )
}

/** Which door letters should be open this tick, given both players' current positions. */
export function computeOpenDoors(level, players) {
  const open = new Set()
  for (const [letter, tile] of Object.entries(level.plates)) {
    if (players.some((p) => overlapsTile(p, tile))) open.add(letter)
  }
  return open
}

export function isLevelComplete(level, player1, player2) {
  return overlapsTile(player1, level.goal1) && overlapsTile(player2, level.goal2)
}
