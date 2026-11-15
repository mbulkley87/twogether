import { describe, expect, it } from 'vitest'
import { createPlayer, stepPlayer, overlapsTile, computeOpenDoors, isLevelComplete, TILE_SIZE, PLAYER_SIZE } from './movement'

// A tiny hand-built level shape, same fields loadTiledLevel() produces.
function makeLevel(overrides = {}) {
  const solid = new Set()
  for (let x = 0; x < 6; x++) {
    solid.add(`${x},0`) // top wall
    solid.add(`${x},5`) // bottom wall
  }
  for (let y = 0; y < 6; y++) {
    solid.add(`0,${y}`) // left wall
    solid.add(`5,${y}`) // right wall
  }
  return { width: 6, height: 6, solid, plates: {}, doors: {}, spawn1: { x: 2, y: 2 }, spawn2: { x: 3, y: 3 }, goal1: { x: 1, y: 1 }, goal2: { x: 4, y: 4 }, ...overrides }
}

describe('createPlayer', () => {
  it('spawns centered on the given tile', () => {
    const player = createPlayer({ x: 2, y: 3 }, 'red')
    expect(player.x).toBeCloseTo(2 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2)
    expect(player.y).toBeCloseTo(3 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2)
    expect(player.moving).toBe(false)
  })
})

describe('stepPlayer', () => {
  it('moves in the direction of input and sets facing', () => {
    const level = makeLevel()
    const player = createPlayer({ x: 2, y: 2 }, 'red')
    const startX = player.x
    stepPlayer(player, { up: false, down: false, left: false, right: true }, level, new Set(), 1 / 60)
    expect(player.x).toBeGreaterThan(startX)
    expect(player.dir).toBe('right')
    expect(player.moving).toBe(true)
  })

  it('does not move when no direction is pressed', () => {
    const level = makeLevel()
    const player = createPlayer({ x: 2, y: 2 }, 'red')
    const { x, y } = player
    stepPlayer(player, { up: false, down: false, left: false, right: false }, level, new Set(), 1 / 60)
    expect(player.x).toBe(x)
    expect(player.y).toBe(y)
    expect(player.moving).toBe(false)
  })

  it('a wall stops movement instead of letting the player pass through', () => {
    const level = makeLevel()
    const player = createPlayer({ x: 1, y: 2 }, 'red') // one tile from the left wall
    for (let i = 0; i < 120; i++) {
      stepPlayer(player, { up: false, down: false, left: true, right: false }, level, new Set(), 1 / 60)
    }
    // Should be stopped flush against the wall (tile x=0), not past it.
    expect(player.x).toBeCloseTo(1 * TILE_SIZE, 0)
  })

  it('diagonal movement is not faster than cardinal movement (no sqrt(2) speed boost)', () => {
    const level = makeLevel()
    const straight = createPlayer({ x: 2, y: 2 }, 'red')
    const diagonal = createPlayer({ x: 2, y: 2 }, 'blue')
    const dt = 1 / 60
    stepPlayer(straight, { up: false, down: false, left: false, right: true }, level, new Set(), dt)
    stepPlayer(diagonal, { up: false, down: true, left: false, right: true }, level, new Set(), dt)

    const straightDist = straight.x - (2 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2)
    const diagonalDist = Math.hypot(
      diagonal.x - (2 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2),
      diagonal.y - (2 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2),
    )
    expect(diagonalDist).toBeCloseTo(straightDist, 5)
  })

  it('a closed door blocks movement, matching plate overlap rules', () => {
    const level = makeLevel({ doors: { a: [{ x: 3, y: 2 }] }, plates: { a: { x: 1, y: 1 } } })
    const player = createPlayer({ x: 2, y: 2 }, 'red')
    for (let i = 0; i < 60; i++) {
      stepPlayer(player, { up: false, down: false, left: false, right: true }, level, new Set(), 1 / 60)
    }
    expect(player.x).toBeLessThanOrEqual(3 * TILE_SIZE - PLAYER_SIZE + 1)
  })
})

describe('computeOpenDoors / isLevelComplete', () => {
  it('a door opens only while a player overlaps its plate', () => {
    const level = makeLevel({ doors: { a: [{ x: 3, y: 2 }] }, plates: { a: { x: 1, y: 1 } } })
    const onPlate = createPlayer(level.plates.a, 'red')
    const elsewhere = createPlayer({ x: 3, y: 3 }, 'blue')
    expect(computeOpenDoors(level, [onPlate, elsewhere]).has('a')).toBe(true)
    expect(computeOpenDoors(level, [elsewhere]).has('a')).toBe(false)
  })

  it('requires both players in their own goal', () => {
    const level = makeLevel()
    const p1AtGoal = createPlayer(level.goal1, 'red')
    const p2AtSpawn = createPlayer(level.spawn2, 'blue')
    const p2AtGoal = createPlayer(level.goal2, 'blue')
    expect(isLevelComplete(level, p1AtGoal, p2AtSpawn)).toBe(false)
    expect(isLevelComplete(level, p1AtGoal, p2AtGoal)).toBe(true)
  })

  it('overlapsTile returns false for a null tile', () => {
    const player = createPlayer({ x: 0, y: 0 }, 'red')
    expect(overlapsTile(player, null)).toBe(false)
  })
})
