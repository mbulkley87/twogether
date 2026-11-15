export const TILE_SIZE = 16
export const PLAYER_SIZE = 12 // slightly smaller than a tile so corners don't catch on walls

const MOVE_SPEED = 64 // px/s - tuned for 16px tiles, not the old 40px side-view ones

export function createPlayer(spawnTile, color) {
  return {
    x: spawnTile.x * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
    y: spawnTile.y * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
    dir: 'down',
    moving: false,
    color,
  }
}

// Doors are solid (closed) unless their letter is in openDoors - same rule
// as the old side-view game, just consumed by a top-down mover now.
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
  const right = Math.floor((player.x + PLAYER_SIZE - 1) / TILE_SIZE)
  const top = Math.floor(player.y / TILE_SIZE)
  const bottom = Math.floor((player.y + PLAYER_SIZE - 1) / TILE_SIZE)

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (!isSolidTile(level, openDoors, tx, ty)) continue
      if (axis === 'x') {
        player.x = delta > 0 ? tx * TILE_SIZE - PLAYER_SIZE : (tx + 1) * TILE_SIZE
      } else {
        player.y = delta > 0 ? ty * TILE_SIZE - PLAYER_SIZE : (ty + 1) * TILE_SIZE
      }
    }
  }
}

/** input: { up, down, left, right } booleans. Mutates player in place. */
export function stepPlayer(player, input, level, openDoors, dt) {
  const rawX = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const rawY = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  player.moving = rawX !== 0 || rawY !== 0

  if (player.moving) {
    // Normalize so diagonal movement isn't faster than cardinal movement
    // (the classic sqrt(2) diagonal-speed bug).
    const len = Math.hypot(rawX, rawY)
    const vx = (rawX / len) * MOVE_SPEED
    const vy = (rawY / len) * MOVE_SPEED

    if (rawX > 0) player.dir = 'right'
    else if (rawX < 0) player.dir = 'left'
    else if (rawY > 0) player.dir = 'down'
    else if (rawY < 0) player.dir = 'up'

    const dx = vx * dt
    player.x += dx
    resolveAxis(player, level, openDoors, 'x', dx)

    const dy = vy * dt
    player.y += dy
    resolveAxis(player, level, openDoors, 'y', dy)
  }
}

export function overlapsTile(player, tile) {
  if (!tile) return false
  const tx1 = tile.x * TILE_SIZE
  const ty1 = tile.y * TILE_SIZE
  return (
    player.x < tx1 + TILE_SIZE &&
    player.x + PLAYER_SIZE > tx1 &&
    player.y < ty1 + TILE_SIZE &&
    player.y + PLAYER_SIZE > ty1
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
