import { writeLevel, TILES } from './build-level.mjs'

const LEGEND = {
  '#': { ground: TILES.FLOOR, wall: TILES.WALL },
  '.': { ground: TILES.FLOOR, wall: null },
  '1': { ground: TILES.FLOOR, wall: null },
  '2': { ground: TILES.FLOOR, wall: null },
  'G': { ground: TILES.GOAL, wall: null },
  'H': { ground: TILES.GOAL, wall: null },
  'a': { ground: TILES.PLATE, wall: null },
  // A door's solidity is purely runtime (open/closed based on game
  // state, see movement.js's isSolidTile) - it must NOT be baked into
  // the static Walls layer as an always-solid tile, or it can never
  // open. The door's visual gets drawn dynamically by the scene instead.
  'A': { ground: TILES.FLOOR, wall: null },
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
  legend: {
    '#': { ground: TILES.FLOOR, wall: TILES.WALL },
    '.': { ground: TILES.FLOOR, wall: null },
    '1': { ground: TILES.FLOOR, wall: null },
  },
  objects: [
    { name: 'spawn1', type: 'spawn', char: '1' },
  ],
})

// Milestone 3: the plate/door mechanic, ported from the old side-view
// "First Steps" level - player1's own goal (G) is reachable without any
// help, but player2's goal (H) is behind door A, on the far side of a
// dividing wall whose only gap is that door. Plate a (in the same zone
// player1 starts in, no crossing needed) is what holds it open.
writeLevel('dungeon1', {
  grid: [
    '############',
    '#....#.....#',
    '#.1.2#.....#',
    '#....#.....#',
    '#G.a.A.....#',
    '#....#.....#',
    '#....#....H#',
    '############',
  ],
  legend: LEGEND,
  objects: [
    { name: 'spawn1', type: 'spawn', char: '1' },
    { name: 'spawn2', type: 'spawn', char: '2' },
    { name: 'goal1', type: 'goal', char: 'G' },
    { name: 'goal2', type: 'goal', char: 'H' },
    { name: 'a', type: 'plate', char: 'a' },
    { name: 'a', type: 'door', char: 'A' },
  ],
})
