// Derives the backend's tiny level-manifest JSON (spawns/goals/plates/
// doors only, no wall geometry - see LevelManifest.java for why) from the
// SAME Tiled .tmj Objects layer the frontend loads, so there is exactly
// one source of truth for a level's puzzle data. Re-run this after
// editing any level's plates/doors/spawns/goals in Tiled - a committed
// test (backend GameSessionServiceTest / a frontend check) should fail
// loudly if this drifts out of sync with the .tmj it came from.
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LEVELS_DIR = join(__dirname, '..', 'public', 'levels')
const OUT_DIR = join(__dirname, '..', '..', 'services', 'game-service', 'src', 'main', 'resources', 'levels')
const TILE_SIZE = 16

export function extractManifest(tiledMap) {
  const objectsLayer = tiledMap.layers.find((l) => l.name === 'Objects')
  const tile = (obj) => ({ x: Math.floor(obj.x / TILE_SIZE), y: Math.floor(obj.y / TILE_SIZE) })

  const manifest = { spawn1: null, spawn2: null, goal1: null, goal2: null, plates: {}, doors: {} }
  for (const obj of objectsLayer?.objects ?? []) {
    if (obj.type === 'spawn' && obj.name === 'spawn1') manifest.spawn1 = tile(obj)
    else if (obj.type === 'spawn' && obj.name === 'spawn2') manifest.spawn2 = tile(obj)
    else if (obj.type === 'goal' && obj.name === 'goal1') manifest.goal1 = tile(obj)
    else if (obj.type === 'goal' && obj.name === 'goal2') manifest.goal2 = tile(obj)
    else if (obj.type === 'plate') manifest.plates[obj.name] = tile(obj)
    else if (obj.type === 'door') {
      manifest.doors[obj.name] = manifest.doors[obj.name] || []
      manifest.doors[obj.name].push(tile(obj))
    }
  }
  return manifest
}

function main() {
  const files = readdirSync(LEVELS_DIR).filter((f) => f.endsWith('.tmj'))
  for (const file of files) {
    const levelId = file.replace(/\.tmj$/, '')
    const tiledMap = JSON.parse(readFileSync(join(LEVELS_DIR, file), 'utf-8'))
    const manifest = extractManifest(tiledMap)
    if (!manifest.spawn1 || !manifest.spawn2 || !manifest.goal1 || !manifest.goal2) {
      console.log(`Skipping ${file} - no spawn2/goal2 (not a 2-player level yet)`)
      continue
    }
    const outPath = join(OUT_DIR, `${levelId}.json`)
    writeFileSync(outPath, JSON.stringify(manifest, null, 2))
    console.log('Wrote', outPath)
  }
}

main()
