import Phaser from 'phaser'
import { loadTiledLevel } from '../loadTiledLevel'
import { createPlayer, stepPlayer, TILE_SIZE, PLAYER_SIZE } from '../movement'

// Door/chest/lever source art (user's own CraftPix subscription, "Top-
// Down Dungeon Pixel Tileset" - not redistributable) uses multi-tile
// compound objects (doors are 32x48, chests/levers 32x32), not single
// 16x16 cells - pre-composited into standalone PNGs once via ImageMagick
// rather than fighting Phaser's uniform-frame spritesheet slicing for
// irregular objects. See these files' provenance in that prep step.
const DOOR_TEXTURE = { CLOSED: 'door-closed', OPEN: 'door-open' }
const PLATE_TEXTURE = { INACTIVE: 'lever-off', ACTIVE: 'lever-on' }
const GOAL_TEXTURE = 'chest'

// Character sprite sheets: 64x64 frames, 4 rows (one per facing direction),
// idle=12 frames/row, walk=6 frames/row - see the asset-swap notes in
// frontend/scripts/build-level.mjs. Visual size is scaled down from the
// 64x64 source to keep characters readable at this tile size without
// overwhelming a small room.
const CHAR_SCALE = 0.5
const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 }
const IDLE_COLS = 12
const WALK_COLS = 6

function createCharacterAnims(scene, prefix, idleKey, walkKey) {
  for (const [dir, row] of Object.entries(DIR_ROW)) {
    scene.anims.create({
      key: `${prefix}-idle-${dir}`,
      frames: scene.anims.generateFrameNumbers(idleKey, { start: row * IDLE_COLS, end: row * IDLE_COLS + IDLE_COLS - 1 }),
      frameRate: 8,
      repeat: -1,
    })
    scene.anims.create({
      key: `${prefix}-walk-${dir}`,
      frames: scene.anims.generateFrameNumbers(walkKey, { start: row * WALK_COLS, end: row * WALK_COLS + WALK_COLS - 1 }),
      frameRate: 10,
      repeat: -1,
    })
  }
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
    this.load.image('walls-floor-tiles', '/tilesets/walls_floor.png')
    this.load.image('door-closed', '/sprites/door_closed.png')
    this.load.image('door-open', '/sprites/door_open.png')
    this.load.image('chest', '/sprites/chest.png')
    this.load.image('lever-off', '/sprites/lever_off.png')
    this.load.image('lever-on', '/sprites/lever_on.png')
    this.load.spritesheet('player1-idle', '/sprites/player1_idle.png', { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('player1-walk', '/sprites/player1_walk.png', { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('player2-idle', '/sprites/player2_idle.png', { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('player2-walk', '/sprites/player2_walk.png', { frameWidth: 64, frameHeight: 64 })
    this.load.tilemapTiledJSON(this.levelKey, `/levels/${this.levelKey}.tmj`)
  }

  create() {
    const tiledMap = this.cache.tilemap.get(this.levelKey).data
    this.level = loadTiledLevel(tiledMap)

    const map = this.make.tilemap({ key: this.levelKey })
    const tileset = map.addTilesetImage('walls_floor', 'walls-floor-tiles')
    map.createLayer('Ground', tileset, 0, 0)
    map.createLayer('Walls', tileset, 0, 0)

    this.plateSprites = {}
    for (const [letter, tile] of Object.entries(this.level.plates)) {
      this.plateSprites[letter] = this.add.image(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE, PLATE_TEXTURE.INACTIVE).setOrigin(0.5, 1)
    }
    this.doorSprites = {}
    for (const [letter, tiles] of Object.entries(this.level.doors)) {
      this.doorSprites[letter] = tiles.map((tile) =>
        this.add.image(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE, DOOR_TEXTURE.CLOSED).setOrigin(0.5, 1),
      )
    }
    for (const goalTile of [this.level.goal1, this.level.goal2]) {
      if (goalTile) this.add.image(goalTile.x * TILE_SIZE + TILE_SIZE / 2, goalTile.y * TILE_SIZE + TILE_SIZE, GOAL_TEXTURE).setOrigin(0.5, 1)
    }

    createCharacterAnims(this, 'p1', 'player1-idle', 'player1-walk')
    createCharacterAnims(this, 'p2', 'player2-idle', 'player2-walk')

    const mySpawn = this.mySlot === 1 ? this.level.spawn1 : this.level.spawn2
    const peerSpawn = this.mySlot === 1 ? this.level.spawn2 : this.level.spawn1
    const myPrefix = this.mySlot === 1 ? 'p1' : 'p2'
    const peerPrefix = this.mySlot === 1 ? 'p2' : 'p1'

    this.myPlayer = createPlayer(mySpawn, myPrefix)
    this.mySprite = this.add.sprite(0, 0, `${myPrefix === 'p1' ? 'player1' : 'player2'}-idle`, 0)
      .setOrigin(0.5, 0.82).setScale(CHAR_SCALE)
    this.peerSprite = this.add.sprite(0, 0, `${peerPrefix === 'p1' ? 'player1' : 'player2'}-idle`, 0)
      .setOrigin(0.5, 0.82).setScale(CHAR_SCALE)
    this.myPrefix = myPrefix
    this.peerPrefix = peerPrefix
    this.positionSprite(this.peerSprite, { x: peerSpawn.x * TILE_SIZE, y: peerSpawn.y * TILE_SIZE, dir: 'down', moving: false }, this.peerPrefix)

    const pixelWidth = this.level.width * TILE_SIZE
    const pixelHeight = this.level.height * TILE_SIZE
    this.cameras.main.setBounds(0, 0, pixelWidth, pixelHeight)
    this.cameras.main.centerOn(pixelWidth / 2, pixelHeight / 2)
  }

  update(time, delta) {
    if (!this.myPlayer) return
    // A backgrounded tab (switching apps on mobile, or just not being the
    // focused window) gets requestAnimationFrame throttled - the next
    // frame's delta can then be huge, which would otherwise move the
    // player a large distance in one step and tunnel straight through a
    // one-tile-wide door gap instead of being stopped by it. Clamp it so
    // a throttled frame just pauses movement instead of jumping.
    const dt = Math.min(delta / 1000, 1 / 30)

    const input = this.readInput()
    const openDoors = this.openDoorsRef?.current ?? new Set()
    stepPlayer(this.myPlayer, input, this.level, openDoors, dt)
    this.positionSprite(this.mySprite, this.myPlayer, this.myPrefix)
    this.sendMove?.(this.myPlayer.x, this.myPlayer.y, this.myPlayer.dir, this.myPlayer.moving)

    const peer = this.peerRef?.current
    if (peer?.x != null) {
      this.positionSprite(this.peerSprite, peer, this.peerPrefix)
    }

    for (const [letter, sprite] of Object.entries(this.plateSprites)) {
      sprite.setTexture(openDoors.has(letter) ? PLATE_TEXTURE.ACTIVE : PLATE_TEXTURE.INACTIVE)
    }
    for (const [letter, sprites] of Object.entries(this.doorSprites)) {
      const texture = openDoors.has(letter) ? DOOR_TEXTURE.OPEN : DOOR_TEXTURE.CLOSED
      sprites.forEach((s) => s.setTexture(texture))
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

  positionSprite(sprite, player, prefix) {
    // Origin is near the sprite's feet (see setOrigin in create()), so
    // position at the center-bottom of the tile-accurate collision box
    // rather than its top-left corner.
    sprite.setPosition(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE)
    const animKey = `${prefix}-${player.moving ? 'walk' : 'idle'}-${player.dir}`
    if (sprite.anims.currentAnim?.key !== animKey) sprite.play(animKey)
  }
}
