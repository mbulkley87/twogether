import Phaser from 'phaser'
import { loadTiledLevel } from '../loadTiledLevel'
import { createPlayer, stepPlayer, computeOpenDoors, isLevelComplete, TILE_SIZE, PLAYER_SIZE } from '../movement'

// Frame indices into public/tilesets/dungeon.png (Kenney "Tiny Dungeon",
// 16x16, 12 cols). See frontend/scripts/build-level.mjs for the same
// indices used to author the tile layers.
const FRAMES = {
  PLAYER_1: 86, // purple-hooded mage
  PLAYER_2: 96, // silver full-helm knight - visually distinct from player 1
  DOOR_CLOSED: 23,
  DOOR_OPEN: 49, // just floor - "open" reads as "the obstacle is gone"
  PLATE: 92,
  GOAL: 91,
}

// Milestone 3 only: this scene temporarily drives TWO locally-controlled
// players (WASD + arrows) to prove the plate/door mechanic survived the
// side-view -> top-down rewrite, before real networking (Milestone 5)
// replaces player 2 with another person's browser entirely. The actual
// shared useKeyboard() hook stays single-player, matching that future.
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

    this.plateSprites = {}
    for (const [letter, tile] of Object.entries(this.level.plates)) {
      this.plateSprites[letter] = this.add.sprite(tile.x * TILE_SIZE, tile.y * TILE_SIZE, 'dungeon-sprites', FRAMES.PLATE).setOrigin(0, 0)
    }
    this.doorSprites = {}
    for (const [letter, tiles] of Object.entries(this.level.doors)) {
      this.doorSprites[letter] = tiles.map((tile) =>
        this.add.sprite(tile.x * TILE_SIZE, tile.y * TILE_SIZE, 'dungeon-sprites', FRAMES.DOOR_CLOSED).setOrigin(0, 0),
      )
    }
    for (const goalTile of [this.level.goal1, this.level.goal2]) {
      if (goalTile) this.add.sprite(goalTile.x * TILE_SIZE, goalTile.y * TILE_SIZE, 'dungeon-sprites', FRAMES.GOAL).setOrigin(0, 0)
    }

    this.player1 = createPlayer(this.level.spawn1, FRAMES.PLAYER_1)
    this.player2 = this.level.spawn2 ? createPlayer(this.level.spawn2, FRAMES.PLAYER_2) : null
    this.sprite1 = this.add.sprite(0, 0, 'dungeon-sprites', FRAMES.PLAYER_1).setOrigin(0, 0)
    this.sprite2 = this.player2 ? this.add.sprite(0, 0, 'dungeon-sprites', FRAMES.PLAYER_2).setOrigin(0, 0) : null

    this.completeText = this.add.text(4, 4, '', { fontSize: '10px', color: '#ffe08a', backgroundColor: '#000000aa' })

    // IJKL, not arrow keys - useKeyboard() already claims WASD *and*
    // arrow keys for the single networked-future local player and calls
    // preventDefault() on them, which stops Phaser's own key listener
    // from ever seeing those same key events. Only matters for this
    // temporary dual-local test; real player 2 input comes over the
    // network from Milestone 5 onward.
    this.player2Keys = this.player2
      ? this.input.keyboard.addKeys({ up: Phaser.Input.Keyboard.KeyCodes.I, down: Phaser.Input.Keyboard.KeyCodes.K, left: Phaser.Input.Keyboard.KeyCodes.J, right: Phaser.Input.Keyboard.KeyCodes.L })
      : null

    const pixelWidth = this.level.width * TILE_SIZE
    const pixelHeight = this.level.height * TILE_SIZE
    this.cameras.main.setBounds(0, 0, pixelWidth, pixelHeight)
    this.cameras.main.centerOn(pixelWidth / 2, pixelHeight / 2)
  }

  update(time, delta) {
    if (!this.player1) return
    const dt = delta / 1000

    const players = this.player2 ? [this.player1, this.player2] : [this.player1]
    const openDoors = computeOpenDoors(this.level, players)

    const input1 = this.inputRef?.current ?? { up: false, down: false, left: false, right: false }
    stepPlayer(this.player1, input1, this.level, openDoors, dt)
    this.positionSprite(this.sprite1, this.player1)

    if (this.player2) {
      const k = this.player2Keys
      const input2 = { up: k.up.isDown, down: k.down.isDown, left: k.left.isDown, right: k.right.isDown }
      stepPlayer(this.player2, input2, this.level, openDoors, dt)
      this.positionSprite(this.sprite2, this.player2)
    }

    for (const [letter, sprite] of Object.entries(this.plateSprites)) {
      sprite.setAlpha(openDoors.has(letter) ? 1 : 0.6)
    }
    for (const [letter, sprites] of Object.entries(this.doorSprites)) {
      const frame = openDoors.has(letter) ? FRAMES.DOOR_OPEN : FRAMES.DOOR_CLOSED
      sprites.forEach((s) => s.setFrame(frame))
    }

    if (this.player2 && isLevelComplete(this.level, this.player1, this.player2)) {
      this.completeText.setText('Complete!')
    }
  }

  positionSprite(sprite, player) {
    sprite.setPosition(
      player.x - (TILE_SIZE - PLAYER_SIZE) / 2,
      player.y - (TILE_SIZE - PLAYER_SIZE) / 2,
    )
    // Tiny Dungeon's characters are single static poses (no walk-cycle
    // sheet) - flip horizontally for left-facing instead of swapping frames.
    sprite.setFlipX(player.dir === 'left')
  }
}
