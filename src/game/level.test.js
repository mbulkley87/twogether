import { describe, expect, it } from 'vitest'
import { parseLevel } from './level'

describe('parseLevel', () => {
  it('extracts spawns, goals, plates, and doors', () => {
    const level = parseLevel([
      '#######',
      '#1  2 #',
      '#.aA. #',
      '#G   H#',
      '#######',
    ])

    expect(level.width).toBe(7)
    expect(level.height).toBe(5)
    expect(level.spawn1).toEqual({ x: 1, y: 1 })
    expect(level.spawn2).toEqual({ x: 4, y: 1 })
    expect(level.goal1).toEqual({ x: 1, y: 3 })
    expect(level.goal2).toEqual({ x: 5, y: 3 })
    expect(level.plates.a).toEqual({ x: 2, y: 2 })
    expect(level.doors.a).toEqual([{ x: 3, y: 2 }])
    expect(level.solid.has('0,0')).toBe(true)
    expect(level.solid.has('1,1')).toBe(false)
  })

  it('throws if a spawn point is missing', () => {
    expect(() => parseLevel(['#####', '#2 G#', '#  H#', '#####'])).toThrow(/spawn/)
  })

  it('throws if a goal zone is missing', () => {
    expect(() => parseLevel(['#####', '#1 2#', '#####'])).toThrow(/goal/)
  })
})
