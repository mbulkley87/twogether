import { describe, expect, it } from 'vitest'
import { loadTiledLevel } from './loadTiledLevel'

// A minimal hand-built Tiled JSON fixture (not loaded from disk) - just
// enough to exercise the Walls-layer-to-solid-set and Objects-layer-to-
// named-points conversion this function is responsible for.
function fixture() {
  const width = 4
  const height = 3
  // Walls layer: a border of solid tiles (gid 2), open floor elsewhere (gid 0).
  const data = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1
      data.push(isBorder ? 2 : 0)
    }
  }
  return {
    width, height,
    layers: [
      { name: 'Ground', type: 'tilelayer', width, height, data: new Array(width * height).fill(1) },
      { name: 'Walls', type: 'tilelayer', width, height, data },
      {
        name: 'Objects', type: 'objectgroup',
        objects: [
          { id: 1, name: 'spawn1', type: 'spawn', x: 16, y: 16, width: 16, height: 16 },
          { id: 2, name: 'spawn2', type: 'spawn', x: 32, y: 16, width: 16, height: 16 },
          { id: 3, name: 'goal1', type: 'goal', x: 16, y: 32, width: 16, height: 16 },
          { id: 4, name: 'goal2', type: 'goal', x: 32, y: 32, width: 16, height: 16 },
          { id: 5, name: 'a', type: 'plate', x: 16, y: 48, width: 16, height: 16 },
          { id: 6, name: 'a', type: 'door', x: 32, y: 48, width: 16, height: 16 },
        ],
      },
    ],
  }
}

describe('loadTiledLevel', () => {
  it('converts the Walls layer into a solid-tile set', () => {
    const level = loadTiledLevel(fixture())
    expect(level.solid.has('0,0')).toBe(true)
    expect(level.solid.has('1,1')).toBe(false)
    expect(level.width).toBe(4)
    expect(level.height).toBe(3)
  })

  it('extracts spawn/goal points and plate/door letters from the Objects layer', () => {
    const level = loadTiledLevel(fixture())
    expect(level.spawn1).toEqual({ x: 1, y: 1 })
    expect(level.spawn2).toEqual({ x: 2, y: 1 })
    expect(level.goal1).toEqual({ x: 1, y: 2 })
    expect(level.goal2).toEqual({ x: 2, y: 2 })
    expect(level.plates.a).toEqual({ x: 1, y: 3 })
    expect(level.doors.a).toEqual([{ x: 2, y: 3 }])
  })
})
