import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import GameScene from '../game/scenes/GameScene'
import { useKeyboard } from '../hooks/useKeyboard'
import { useTouchJoystick } from '../hooks/useTouchJoystick'
import { connectGameSocket } from '../net/gameSocket'
import TouchControls from './TouchControls'

const TILE_SIZE = 16

export default function PhaserGame({ levelKey, mapWidth, mapHeight, gameId, playerId, mySlot, onComplete, onStatusChange }) {
  const containerRef = useRef(null)
  const keyboardRef = useKeyboard()
  const touch = useTouchJoystick()
  const gameRef = useRef(null)
  const socketRef = useRef(null)
  const peerRef = useRef({ x: null, y: null, dir: 'down', moving: false })
  const openDoorsRef = useRef(new Set())
  const [showTouchControls] = useState(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    const socket = connectGameSocket({
      gameId,
      playerId,
      onPeerMove: (msg) => {
        peerRef.current = { x: msg.x, y: msg.y, dir: msg.dir, moving: msg.moving }
      },
      onState: (msg) => {
        openDoorsRef.current = new Set(msg.openDoors)
      },
      onComplete: (msg) => onComplete?.(msg.elapsedMs),
      onStatusChange,
    })
    socketRef.current = socket
    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, playerId])

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: mapWidth * TILE_SIZE,
      height: mapHeight * TILE_SIZE,
      backgroundColor: '#1a1a24',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [GameScene],
    })
    game.scene.start('GameScene', {
      levelKey,
      keyboardRef,
      touchRef: touch.stateRef,
      mySlot,
      peerRef,
      openDoorsRef,
      sendMove: (x, y, dir, moving) => socketRef.current?.sendMove(x, y, dir, moving),
    })
    gameRef.current = game

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey, mySlot])

  return (
    <div className="twogether-game-wrapper">
      <div
        ref={containerRef}
        className="twogether-phaser-container"
        style={{ '--map-aspect': `${mapWidth} / ${mapHeight}` }}
      />
      {showTouchControls && (
        <TouchControls
          origin={touch.origin}
          onPointerDown={touch.onPointerDown}
          onPointerMove={touch.onPointerMove}
          onPointerUp={touch.onPointerUp}
        />
      )}
    </div>
  )
}
