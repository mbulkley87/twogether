import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import GameScene from '../game/scenes/GameScene'
import { useKeyboard } from '../hooks/useKeyboard'

const TILE_SIZE = 16

export default function PhaserGame({ levelKey, mapWidth, mapHeight }) {
  const containerRef = useRef(null)
  const inputRef = useKeyboard()
  const gameRef = useRef(null)

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
    game.scene.start('GameScene', { levelKey, inputRef })
    gameRef.current = game

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey])

  return (
    <div
      ref={containerRef}
      className="twogether-phaser-container"
      style={{ '--map-aspect': `${mapWidth} / ${mapHeight}` }}
    />
  )
}
