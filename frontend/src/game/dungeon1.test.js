import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { loadTiledLevel } from './loadTiledLevel'
import { createPlayer, stepPlayer, computeOpenDoors, overlapsTile, isLevelComplete } from './movement'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadLevel(name) {
  const tiledMap = JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'levels', `${name}.tmj`), 'utf-8'))
  return loadTiledLevel(tiledMap)
}

function walkToward(player, target) {
  const dx = target.x - player.x
  const dy = target.y - player.y
  return {
    left: dx < -1, right: dx > 1,
    up: dy < -1, down: dy > 1,
  }
}

// Scripts the actual intended solution through the real movement engine,
// same discipline as the old side-view level tests: don't just eyeball
// the layout, prove it by driving the real stepPlayer/computeOpenDoors/
// isLevelComplete functions through a real playthrough.
describe('dungeon1 (ported "First Steps" puzzle)', () => {
  it('is solvable: player1 holds the plate until player2 is through the door, then both reach their own goals', () => {
    const level = loadLevel('dungeon1')
    const p1 = createPlayer(level.spawn1, 'red')
    const p2 = createPlayer(level.spawn2, 'blue')
    const dt = 1 / 60
    const plateTile = level.plates.a
    const doorTile = level.doors.a[0]

    // A straight line to the final goal isn't a real path - it can cut a
    // diagonal corner through where the one-tile-wide door gap isn't, and
    // end up pinned against a solid wall one row off. Give player2
    // waypoints that thread the actual gap: align with the door's row,
    // cross it, then head for the goal.
    const p2Waypoints = [
      { x: doorTile.x * 16 - 4, y: doorTile.y * 16 + 2 }, // line up with the door's row, just before it
      { x: (doorTile.x + 1) * 16 + 4, y: doorTile.y * 16 + 2 }, // just past the door
      { x: level.goal2.x * 16, y: level.goal2.y * 16 },
    ]
    let waypointIndex = 0

    let completed = false
    for (let tick = 0; tick < 1200 && !completed; tick++) {
      const openDoors = computeOpenDoors(level, [p1, p2])
      const p2PastDoor = p2.x > (doorTile.x + 1) * 16
      const p1Target = p2PastDoor ? level.goal1 : plateTile

      const currentWaypoint = p2Waypoints[waypointIndex]
      if (waypointIndex < p2Waypoints.length - 1 && Math.hypot(p2.x - currentWaypoint.x, p2.y - currentWaypoint.y) < 3) {
        waypointIndex += 1
      }

      stepPlayer(p1, walkToward(p1, { x: p1Target.x * 16, y: p1Target.y * 16 }), level, openDoors, dt)
      stepPlayer(p2, walkToward(p2, p2Waypoints[waypointIndex]), level, openDoors, dt)
      completed = isLevelComplete(level, p1, p2)
    }

    expect(completed).toBe(true)
  })

  it('the door stays closed and blocks player2 if player1 never holds the plate', () => {
    const level = loadLevel('dungeon1')
    const p1 = createPlayer(level.spawn1, 'red') // never moves
    const p2 = createPlayer(level.spawn2, 'blue')
    const dt = 1 / 60

    for (let tick = 0; tick < 300; tick++) {
      const openDoors = computeOpenDoors(level, [p1, p2])
      stepPlayer(p2, walkToward(p2, { x: level.goal2.x * 16, y: level.goal2.y * 16 }), level, openDoors, dt)
    }

    expect(overlapsTile(p2, level.goal2)).toBe(false)
  })
})
