// Generates a real Tiled JSON (.tmj) map file from a small, readable
// description instead of hand-typing tile GIDs - there's no Tiled desktop
// app available in this environment to author maps visually, so this is
// a bridge: the OUTPUT is a genuine Tiled-format file (still editable
// later in the real Tiled app), even though the INPUT here is a plain
// JS description. Tile indices below refer to frames in
// public/tilesets/dungeon.png (Kenney "Tiny Dungeon", 16x16, 12 cols,
// 0-based frame index = row*12+col).
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const TILES = {
  FLOOR: 49,
  WALL: 37,
  DOOR: 23,
  PLATE: 92,
  GOAL: 91,
}

// gid = 0 means "no tile"; otherwise frame index + 1 (Tiled's firstgid=1 convention).
function gid(tileIndex) {
  return tileIndex === null ? 0 : tileIndex + 1
}

/**
 * grid: array of strings, one per row, one character per column.
 * legend: maps a character to { ground: tileIndex|null, wall: tileIndex|null }.
 * objects: array of { name, type, char } OR { name, type, x, y } (tile coords) -
 *   if `char` is given, every occurrence of that character becomes a point object
 *   named `name` (suffixed with an index if there's more than one).
 */
export function buildLevel({ grid, legend, objects = [], tilesetImage = '../tilesets/dungeon.png' }) {
  const height = grid.length
  const width = grid[0].length
  if (grid.some((row) => row.length !== width)) {
    throw new Error('All rows in a level grid must have the same width')
  }

  const groundData = []
  const wallData = []
  for (const row of grid) {
    for (const ch of row) {
      const tile = legend[ch]
      if (!tile) throw new Error(`No legend entry for character '${ch}'`)
      groundData.push(gid(tile.ground))
      wallData.push(gid(tile.wall))
    }
  }

  const resolvedObjects = []
  let nextId = 1
  for (const obj of objects) {
    if (obj.char) {
      let count = 0
      grid.forEach((row, y) => {
        row.split('').forEach((ch, x) => {
          if (ch === obj.char) {
            count += 1
            const name = count > 1 || grid.flatMap((r) => r.split('')).filter((c) => c === obj.char).length > 1
              ? `${obj.name}${count}`
              : obj.name
            resolvedObjects.push({
              id: nextId++, name, type: obj.type, x: x * 16, y: y * 16, width: 16, height: 16,
              visible: true, properties: obj.properties ?? [],
            })
          }
        })
      })
    } else {
      resolvedObjects.push({
        id: nextId++, name: obj.name, type: obj.type, x: obj.x * 16, y: obj.y * 16,
        width: 16, height: 16, visible: true, properties: obj.properties ?? [],
      })
    }
  }

  return {
    type: 'map',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width, height,
    tilewidth: 16, tileheight: 16,
    infinite: false,
    tiledversion: '1.10.2',
    version: '1.10',
    nextlayerid: 4,
    nextobjectid: nextId,
    tilesets: [{
      firstgid: 1,
      name: 'dungeon',
      image: tilesetImage,
      imagewidth: 192,
      imageheight: 176,
      tilewidth: 16,
      tileheight: 16,
      columns: 12,
      tilecount: 132,
      margin: 0,
      spacing: 0,
    }],
    layers: [
      { id: 1, name: 'Ground', type: 'tilelayer', width, height, x: 0, y: 0, opacity: 1, visible: true, data: groundData },
      { id: 2, name: 'Walls', type: 'tilelayer', width, height, x: 0, y: 0, opacity: 1, visible: true, data: wallData, properties: [{ name: 'collides', type: 'bool', value: true }] },
      { id: 3, name: 'Objects', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, objects: resolvedObjects },
    ],
  }
}

export function writeLevel(name, levelDef) {
  const outPath = join(__dirname, '..', 'public', 'levels', `${name}.tmj`)
  writeFileSync(outPath, JSON.stringify(buildLevel(levelDef), null, 2))
  console.log('Wrote', outPath)
}
