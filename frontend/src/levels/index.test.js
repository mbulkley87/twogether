import { describe, expect, it } from 'vitest'
import { LEVELS } from './index'
import { createPlayer, stepPlayer, computeOpenDoors, overlapsTile, isLevelComplete } from '../game/physics'

describe('LEVELS', () => {
  it('every level parses with a spawn/goal for each player and matching plate/door letters', () => {
    expect(LEVELS.length).toBeGreaterThan(0)
    for (const level of LEVELS) {
      expect(level.spawn1).toBeTruthy()
      expect(level.spawn2).toBeTruthy()
      expect(level.goal1).toBeTruthy()
      expect(level.goal2).toBeTruthy()
      for (const letter of Object.keys(level.plates)) {
        expect(level.doors[letter], `level "${level.name}" plate ${letter} has no matching door`).toBeTruthy()
      }
      for (const letter of Object.keys(level.doors)) {
        expect(level.plates[letter], `level "${level.name}" door ${letter} has no matching plate`).toBeTruthy()
      }
    }
  })
})

// Drives the actual physics engine through the intended solution for each
// level, exactly like a real play session would, rather than reasoning
// about tile positions by hand - that's how the first draft's deadlocked
// layouts would have been caught before shipping.
function runToCompletion(level, scripts, maxTicks = 600) {
  const p1 = createPlayer(level.spawn1, 'red')
  const p2 = createPlayer(level.spawn2, 'blue')
  const dt = 1 / 60
  for (let tick = 0; tick < maxTicks; tick++) {
    const openDoors = computeOpenDoors(level, [p1, p2])
    const in1 = scripts.p1(tick, p1, p2, level)
    const in2 = scripts.p2(tick, p1, p2, level)
    stepPlayer(p1, in1, level, openDoors, dt)
    stepPlayer(p2, in2, level, openDoors, dt)
    if (isLevelComplete(level, p1, p2)) return { completed: true, tick }
  }
  return { completed: false, p1, p2 }
}

function walkToward(player, targetTile) {
  const targetX = targetTile.x * 40
  if (Math.abs(player.x - targetX) < 2) return { left: false, right: false, jump: false }
  return { left: player.x > targetX, right: player.x < targetX, jump: false }
}

describe('level solvability (real physics playthrough)', () => {
  it('First Steps: player1 holds plate a until player2 is past door A, then both reach their own goals', () => {
    const level = LEVELS.find((l) => l.name === 'First Steps')
    const plateA = level.plates.a
    const result = runToCompletion(level, {
      p1: (tick, p1) => {
        // Stand on the plate until player 2 has cleared the door, then head to goal G.
        const clearedDoor = p1.__p2Cleared
        return walkToward(p1, clearedDoor ? level.goal1 : plateA)
      },
      p2: (tick, p1, p2) => {
        const input = walkToward(p2, level.goal2)
        // Only let go of the plate once player 2 is fully past the door
        // tile, not just touching its leading edge - letting go while
        // player 2 is still standing inside it closes the door on them.
        const doorTile = level.doors.a[0]
        if (overlapsTile(p2, level.goal2) || p2.x >= (doorTile.x + 1) * 40) p1.__p2Cleared = true
        return input
      },
    })
    expect(result.completed).toBe(true)
  })

  it('Split Path: player2 detours to the top-corridor plate so player1 can get past door A to goal G', () => {
    const level = LEVELS.find((l) => l.name === 'Split Path')
    const plateA = level.plates.a
    const result = runToCompletion(level, {
      p1: (tick, p1) => walkToward(p1, level.goal1),
      p2: (tick, p1, p2) => {
        const p1Past = overlapsTile(p1, level.goal1)
        return walkToward(p2, p1Past ? level.goal2 : plateA)
      },
    })
    expect(result.completed).toBe(true)
  })
})
