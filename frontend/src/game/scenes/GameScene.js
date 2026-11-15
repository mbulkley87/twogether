import Phaser from 'phaser'
import { loadTiledLevel } from '../loadTiledLevel'
import { createPlayer, stepPlayer, TILE_SIZE, PLAYER_SIZE } from '../movement'

// Frame indices into public/tilesets/dungeon.png (Kenney "Tiny Dungeon",
// 16x16, 12 cols). See frontend/scripts/build-level.mjs for the same
// indices used to author the tile layers.
const PLAYER_FRAME = 86 // purple-hooded mage

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  init(data) {
    this.levelKey = data.levelKey
    this.inputRef = data.inputRef
  }

  preload() {
    this.load.image('dungeon-tiles', '/tilesets/dungeon.png')
    this.load.spritesheet('dungeon-sprites', '/tilesets/dungeon.png', { frameWidth: 16, frameHeight: 16 })
    this.load.tilemapTiledJSON(this.levelKey, `/levels/${this.levelKey}.tmj`)
  }

  create() {
    const tiledMap = this.cache.tilemap.get(this.levelKey).data
    this.level = loadTiledLevel(tiledMap)

    const map = this.make.tilemap({ key: this.levelKey })
    const tileset = map.addTilesetImage('dungeon', 'dungeon-tiles')
    map.createLayer('Ground', tileset, 0, 0)
    map.createLayer('Walls', tileset, 0, 0)

    this.player = createPlayer(this.level.spawn1 ?? { x: 1, y: 1 }, 0x9b7bd6)
    this.sprite = this.add.sprite(0, 0, 'dungeon-sprites', PLAYER_FRAME)
    this.sprite.setOrigin(0, 0)

    const pixelWidth = this.level.width * TILE_SIZE
    const pixelHeight = this.level.height * TILE_SIZE
    this.cameras.main.setBounds(0, 0, pixelWidth, pixelHeight)
    this.cameras.main.centerOn(pixelWidth / 2, pixelHeight / 2)
  }

  update(time, delta) {
    if (!this.player) return
    const dt = delta / 1000
    const input = this.inputRef?.current ?? { up: false, down: false, left: false, right: false }
    const openDoors = new Set() // no plates/doors yet - that's the next milestone

    stepPlayer(this.player, input, this.level, openDoors, dt)

    this.sprite.setPosition(
      this.player.x - (TILE_SIZE - PLAYER_SIZE) / 2,
      this.player.y - (TILE_SIZE - PLAYER_SIZE) / 2,
    )
    // Tiny Dungeon's characters are single static poses (no walk-cycle
    // sheet) - flip horizontally for left-facing instead of swapping frames.
    this.sprite.setFlipX(this.player.dir === 'left')
  }
}
