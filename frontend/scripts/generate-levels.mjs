import { writeLevel, TILES } from './build-level.mjs'

const LEGEND = {
  '#': { ground: TILES.FLOOR, wall: TILES.WALL },
  '.': { ground: TILES.FLOOR, wall: null },
  '1': { ground: TILES.FLOOR, wall: null },
}

// Milestone 2: one simple room, no puzzle mechanic yet - just proving
// Phaser mounts, loads a real Tiled map, and a sprite moves/collides.
writeLevel('room1', {
  grid: [
    '##########',
    '#........#',
    '#........#',
    '#....1...#',
    '#........#',
    '#........#',
    '#........#',
    '##########',
  ],
  legend: LEGEND,
  objects: [
    { name: 'spawn1', type: 'spawn', char: '1' },
  ],
})
