import { useEffect, useRef } from 'react'
import {
  TILE_SIZE, PLAYER_WIDTH, PLAYER_HEIGHT,
  createPlayer, stepPlayer, computeOpenDoors, isLevelComplete,
} from '../game/physics'
import { useKeyboard } from '../hooks/useKeyboard'

const COLORS = {
  wall: '#2b2d42',
  open: '#101016',
  plateClosed: '#f4a259',
  plateOpen: '#ffd27f',
  doorClosed: '#5c6b73',
  doorOpen: 'rgba(92, 107, 115, 0.18)',
  goal1: 'rgba(230, 57, 70, 0.3)',
  goal2: 'rgba(69, 123, 157, 0.3)',
  p1: '#e63946',
  p2: '#457b9d',
}

function drawLevel(ctx, level, openDoors) {
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      ctx.fillStyle = level.solid.has(`${x},${y}`) ? COLORS.wall : COLORS.open
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }

  ctx.fillStyle = COLORS.goal1
  ctx.fillRect(level.goal1.x * TILE_SIZE, level.goal1.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = COLORS.goal2
  ctx.fillRect(level.goal2.x * TILE_SIZE, level.goal2.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)

  for (const [letter, tile] of Object.entries(level.plates)) {
    ctx.fillStyle = openDoors.has(letter) ? COLORS.plateOpen : COLORS.plateClosed
    ctx.fillRect(tile.x * TILE_SIZE + 6, tile.y * TILE_SIZE + TILE_SIZE - 10, TILE_SIZE - 12, 8)
  }

  for (const [letter, tiles] of Object.entries(level.doors)) {
    ctx.fillStyle = openDoors.has(letter) ? COLORS.doorOpen : COLORS.doorClosed
    for (const tile of tiles) {
      ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }
}

function drawPlayer(ctx, player) {
  ctx.fillStyle = player.color
  ctx.fillRect(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT)
}

export default function GameCanvas({ level, onComplete }) {
  const canvasRef = useRef(null)
  const inputRef = useKeyboard()
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = level.width * TILE_SIZE
    canvas.height = level.height * TILE_SIZE

    const p1 = createPlayer(level.spawn1, COLORS.p1)
    const p2 = createPlayer(level.spawn2, COLORS.p2)

    let lastTime = performance.now()
    let done = false
    let frameId

    function loop(now) {
      const dt = Math.min((now - lastTime) / 1000, 1 / 30)
      lastTime = now

      if (!done) {
        const openDoors = computeOpenDoors(level, [p1, p2])
        stepPlayer(p1, inputRef.current.p1, level, openDoors, dt)
        stepPlayer(p2, inputRef.current.p2, level, openDoors, dt)

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawLevel(ctx, level, openDoors)
        drawPlayer(ctx, p1)
        drawPlayer(ctx, p2)

        if (isLevelComplete(level, p1, p2)) {
          done = true
          onCompleteRef.current()
        }
      }

      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [level, inputRef])

  return <canvas ref={canvasRef} className="twogether-canvas" />
}
