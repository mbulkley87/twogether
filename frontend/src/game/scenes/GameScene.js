import Phaser from 'phaser'
import { loadTiledLevel } from '../loadTiledLevel'
import { createPlayer, stepPlayer, TILE_SIZE, PLAYER_SIZE } from '../movement'

// Frame indices into public/tilesets/dungeon.png (Kenney "Tiny Dungeon",
// 16x16, 12 cols). See frontend/scripts/build-level.mjs for the same
// indices used to author the tile layers.
const FRAMES = {
  PLAYER_1: 86, // purple-hooded mage
  PLAYER_2: 96, // silver full-helm knight
  DOOR_CLOSED: 23,
  DOOR_OPEN: 49,
  PLATE: 92,
  GOAL: 91,
}

// Real networked multiplayer: "my" player is driven by local input and
// reported to the server; the other player is rendered purely from
// relayed positions, never simulated locally. Door state and completion
// come ONLY from the server's state/complete messages (openDoorsRef,
// passed in from PhaserGame.jsx) - never recomputed here from peer data,
// which could legitimately disagree between the two screens since each
// only has a stale, network-delayed copy of the other's position. See
// GameSessionService.java for the full reasoning.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  init(data) {
    this.levelKey = data.levelKey
    this.keyboardRef = data.keyboardRef
    this.touchRef = data.touchRef
    this.mySlot = data.mySlot
    this.peerRef = data.peerRef
    this.openDoorsRef = data.openDoorsRef
    this.sendMove = data.sendMove
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

    const mySpawn = this.mySlot === 1 ? this.level.spawn1 : this.level.spawn2
    const peerSpawn = this.mySlot === 1 ? this.level.spawn2 : this.level.spawn1
    const myFrame = this.mySlot === 1 ? FRAMES.PLAYER_1 : FRAMES.PLAYER_2
    const peerFrame = this.mySlot === 1 ? FRAMES.PLAYER_2 : FRAMES.PLAYER_1

    this.myPlayer = createPlayer(mySpawn, myFrame)
    this.mySprite = this.add.sprite(0, 0, 'dungeon-sprites', myFrame).setOrigin(0, 0)
    this.peerSprite = this.add.sprite(0, 0, 'dungeon-sprites', peerFrame).setOrigin(0, 0)
    this.positionSprite(this.peerSprite, { x: peerSpawn.x * TILE_SIZE, y: peerSpawn.y * TILE_SIZE, dir: 'down' })

    const pixelWidth = this.level.width * TILE_SIZE
    const pixelHeight = this.level.height * TILE_SIZE
    this.cameras.main.setBounds(0, 0, pixelWidth, pixelHeight)
    this.cameras.main.centerOn(pixelWidth / 2, pixelHeight / 2)
  }

  update(time, delta) {
    if (!this.myPlayer) return
    // A backgrounded tab (switching apps on mobile, or just not being the
    // focused window) gets requestAnimationFrame throttled by the browser -
    // the next frame's delta can then be huge, which would otherwise move
    // the player a large distance in one step and tunnel straight through
    // a one-tile-wide door gap instead of being stopped by it. Clamp it so
    // a throttled frame just pauses movement instead of jumping.
    const dt = Math.min(delta / 1000, 1 / 30)

    const input = this.readInput()
    const openDoors = this.openDoorsRef?.current ?? new Set()
    stepPlayer(this.myPlayer, input, this.level, openDoors, dt)
    this.positionSprite(this.mySprite, this.myPlayer)
    this.sendMove?.(this.myPlayer.x, this.myPlayer.y, this.myPlayer.dir, this.myPlayer.moving)

    const peer = this.peerRef?.current
    if (peer?.x != null) {
      this.positionSprite(this.peerSprite, peer)
    }

    for (const [letter, sprite] of Object.entries(this.plateSprites)) {
      sprite.setAlpha(openDoors.has(letter) ? 1 : 0.6)
    }
    for (const [letter, sprites] of Object.entries(this.doorSprites)) {
      const frame = openDoors.has(letter) ? FRAMES.DOOR_OPEN : FRAMES.DOOR_CLOSED
      sprites.forEach((s) => s.setFrame(frame))
    }
  }

  // Merged at read time rather than write time - keyboard and touch are
  // two independent input sources feeding the same shape, either can
  // drive movement on its own and both can be held at once.
  readInput() {
    const keys = this.keyboardRef?.current ?? {}
    const touch = this.touchRef?.current ?? {}
    return {
      up: Boolean(keys.up || touch.up),
      down: Boolean(keys.down || touch.down),
      left: Boolean(keys.left || touch.left),
      right: Boolean(keys.right || touch.right),
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
