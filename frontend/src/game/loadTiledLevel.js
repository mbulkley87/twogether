import { TILE_SIZE } from './movement'

// Converts a Tiled JSON map object (as Phaser's tilemap loader hands back
// via `scene.cache.tilemap.get(key).data`, or just a parsed .tmj) into the
// same shape the old ASCII parseLevel() produced: {width, height, solid,
// plates, doors, spawn1, spawn2, goal1, goal2}. Walls/visuals come from the
// "Walls" tile layer; plates/doors/spawns/goals come from the "Objects"
// layer's point objects, keyed by `name` (a letter for plate/door, or
// "spawn1"/"spawn2"/"goal1"/"goal2").
export function loadTiledLevel(tiledMap) {
  const width = tiledMap.width
  const height = tiledMap.height

  const wallsLayer = tiledMap.layers.find((l) => l.name === 'Walls')
  const objectsLayer = tiledMap.layers.find((l) => l.name === 'Objects')

  const solid = new Set()
  if (wallsLayer) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (wallsLayer.data[y * width + x] !== 0) solid.add(`${x},${y}`)
      }
    }
  }

  const plates = {}
  const doors = {}
  let spawn1 = null
  let spawn2 = null
  let goal1 = null
  let goal2 = null

  for (const obj of objectsLayer?.objects ?? []) {
    const tile = { x: Math.floor(obj.x / TILE_SIZE), y: Math.floor(obj.y / TILE_SIZE) }
    if (obj.type === 'spawn' && obj.name === 'spawn1') spawn1 = tile
    else if (obj.type === 'spawn' && obj.name === 'spawn2') spawn2 = tile
    else if (obj.type === 'goal' && obj.name === 'goal1') goal1 = tile
    else if (obj.type === 'goal' && obj.name === 'goal2') goal2 = tile
    else if (obj.type === 'plate') plates[obj.name] = tile
    else if (obj.type === 'door') {
      doors[obj.name] = doors[obj.name] || []
      doors[obj.name].push(tile)
    }
  }

  return { width, height, solid, plates, doors, spawn1, spawn2, goal1, goal2 }
}
