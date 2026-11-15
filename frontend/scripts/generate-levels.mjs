import { writeLevel, TILES } from './build-level.mjs'

// Goals/plates/doors are all plain floor in the static layer - their
// actual visuals (chest, lever, door) are drawn dynamically by the scene
// on top, from the Objects layer below, so they can change appearance
// (open/closed) at runtime. A door's solidity is likewise purely runtime
// (see movement.js's isSolidTile) - it must NOT be baked into the static
// Walls layer as an always-solid tile, or it can never open.
const LEGEND = {
  '#': { ground: TILES.FLOOR, wall: TILES.WALL },
  '.': { ground: TILES.FLOOR, wall: null },
  '1': { ground: TILES.FLOOR, wall: null },
  '2': { ground: TILES.FLOOR, wall: null },
  'G': { ground: TILES.FLOOR, wall: null },
  'H': { ground: TILES.FLOOR, wall: null },
  'a': { ground: TILES.FLOOR, wall: null },
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
