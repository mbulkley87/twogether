import { describe, expect, it } from 'vitest'
import { parseLevel } from './level'
import {
  TILE_SIZE, PLAYER_WIDTH, PLAYER_HEIGHT,
  createPlayer, stepPlayer, overlapsTile, computeOpenDoors, isLevelComplete,
} from './physics'

// Spawns and goals share one open row with solid floor DIRECTLY beneath it -
// deliberately, so a player resting on that floor doesn't drift into a
// different tile row mid-test (an earlier draft of this level had an extra
// open row between spawns and the floor, which let a player fall past the
// row a horizontal-collision test cared about before the assertion ran).
function flatGroundLevel() {
  return parseLevel([
    '#######',
    '#1   2#',
    '#G   H#',
    '#######',
  ])
}

describe('createPlayer', () => {
  it('spawns centered on the given tile, feet at the tile floor', () => {
    const level = flatGroundLevel()
    const player = createPlayer(level.spawn1, 'red')

    expect(player.x).toBeCloseTo(level.spawn1.x * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) / 2)
    expect(player.y).toBe(level.spawn1.y * TILE_SIZE + (TILE_SIZE - PLAYER_HEIGHT))
    expect(player.onGround).toBe(false)
  })
})

describe('stepPlayer', () => {
  it('a player resting on solid ground stays on ground with no input', () => {
    const level = flatGroundLevel()
    const player = createPlayer(level.spawn1, 'red')
    const openDoors = new Set()

    // Enough ticks to fully settle onto the floor below, how ever many
    // tiles it has to fall through to get there.
    for (let i = 0; i < 60; i++) {
      stepPlayer(player, { left: false, right: false, jump: false }, level, openDoors, 1 / 60)
    }

    expect(player.onGround).toBe(true)
  })

  it('a player with nothing below falls (gravity actually moves them down)', () => {
    const level = parseLevel([
      '######',
      '#1  2#',
      '#    #',
      '#G  H#',
      '######',
    ])
    const player = createPlayer(level.spawn1, 'red')
    const startY = player.y

    stepPlayer(player, { left: false, right: false, jump: false }, level, new Set(), 1 / 60)

    expect(player.y).toBeGreaterThan(startY)
    expect(player.onGround).toBe(false)
  })

  it('jump only works while on the ground', () => {
    const level = flatGroundLevel()
    const player = createPlayer(level.spawn1, 'red')
    for (let i = 0; i < 60; i++) stepPlayer(player, { left: false, right: false, jump: false }, level, new Set(), 1 / 60)
    expect(player.onGround).toBe(true)

    stepPlayer(player, { left: false, right: false, jump: true }, level, new Set(), 1 / 60)
    expect(player.vy).toBeLessThan(0) // moving upward

    // Mid-air jump input should NOT re-trigger a jump impulse.
    const midAirVy = player.vy
    stepPlayer(player, { left: false, right: false, jump: true }, level, new Set(), 1 / 60)
    expect(player.vy).toBeGreaterThan(midAirVy) // gravity still accumulating, no fresh jump impulse
  })
})

describe('the hold-the-button-for-your-partner mechanic', () => {
  // One flat corridor with solid floor directly beneath it the whole way -
  // deliberately no second open row to fall through, so a player resting on
  // the floor stays in this exact tile row for the entire test instead of
  // drifting down into an unrelated, unobstructed row below the door.
  // Goals share the same row (parseLevel requires both to exist) - this
  // suite doesn't exercise goal behavior, just the door/plate mechanic.
  function doorLevel() {
    return parseLevel([
      '##########',
      '#1G a AH2#',
      '##########',
    ])
  }

  it('a closed door blocks movement', () => {
    const level = doorLevel()
    const player = createPlayer({ x: 2, y: 1 }, 'red')
    const openDoors = new Set() // nobody on the plate
    for (let i = 0; i < 10; i++) stepPlayer(player, { left: false, right: false, jump: false }, level, openDoors, 1 / 60) // settle onto the floor first

    for (let i = 0; i < 60; i++) {
      stepPlayer(player, { left: false, right: true, jump: false }, level, openDoors, 1 / 60)
    }

    // Should be stopped at the door's left edge (door tile x=6), not past it.
    expect(player.x).toBeLessThanOrEqual(6 * TILE_SIZE - PLAYER_WIDTH + 1)
  })

  it('standing on the plate opens the matching door for the OTHER player', () => {
    const level = doorLevel()
    const mover = createPlayer({ x: 2, y: 1 }, 'red')
    const holder = createPlayer(level.plates.a, 'blue')
    for (let i = 0; i < 10; i++) stepPlayer(mover, { left: false, right: false, jump: false }, level, new Set(), 1 / 60)

    const openDoors = computeOpenDoors(level, [mover, holder])
    expect(openDoors.has('a')).toBe(true)

    for (let i = 0; i < 60; i++) {
      stepPlayer(mover, { left: false, right: true, jump: false }, level, openDoors, 1 / 60)
    }

    // With the door open, the mover should get past where it blocked before.
    expect(mover.x).toBeGreaterThan(6 * TILE_SIZE)
  })

  it('stepping off the plate closes the door again', () => {
    const level = doorLevel()
    const holder = createPlayer(level.plates.a, 'blue')
    const openWhileOn = computeOpenDoors(level, [holder])
    expect(openWhileOn.has('a')).toBe(true)

    const awayFromPlate = createPlayer(level.spawn2, 'blue')
    const openWhileOff = computeOpenDoors(level, [awayFromPlate])
    expect(openWhileOff.has('a')).toBe(false)
  })
})

describe('isLevelComplete', () => {
  it('requires BOTH players in their own goal, not either one', () => {
    const level = flatGroundLevel()
    const p1 = createPlayer(level.goal1, 'red')
    const p2AtSpawn = createPlayer(level.spawn2, 'blue')
    const p2AtGoal = createPlayer(level.goal2, 'blue')

    expect(isLevelComplete(level, p1, p2AtSpawn)).toBe(false)
    expect(isLevelComplete(level, p1, p2AtGoal)).toBe(true)
  })

  it('a player in the WRONG goal does not count', () => {
    const level = flatGroundLevel()
    const p1AtP2Goal = createPlayer(level.goal2, 'red')
    const p2AtGoal = createPlayer(level.goal2, 'blue')

    expect(overlapsTile(p1AtP2Goal, level.goal1)).toBe(false)
    expect(isLevelComplete(level, p1AtP2Goal, p2AtGoal)).toBe(false)
  })
})
