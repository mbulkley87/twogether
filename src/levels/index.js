import { parseLevel } from '../game/level'

// A plate directly next to its own door can never be crossed solo - the
// instant you step off the plate to walk into the door, it closes right
// in front of you. That's deliberate (it's what forces two players
// instead of one), but it also means a level can't just be a straight
// corridor with sequential gates - whoever holds a gate open gets
// permanently stuck behind it with no way back unless there's a genuinely
// separate, unobstructed path for their partner to reach a second control
// point. Both levels below are built around that.
const RAW_LEVELS = [
  {
    name: 'First Steps',
    // Straight corridor. Player 1's own goal (G) sits on the near side,
    // no obstacle in the way - but Player 2's goal (H) is past door A,
    // which only plate a (just before it) can open. Nothing stops Player
    // 1 from just walking to G immediately, but the level only completes
    // once Player 1 holds the plate long enough for Player 2 to get
    // through first.
    rows: [
      '#############',
      '#  12        #',
      '#G    aA   H#',
      '#############',
    ],
  },
  {
    name: 'Split Path',
    // Two parallel corridors joined only by a one-way shaft Player 1
    // falls down at the start. Player 2's path (top) is completely
    // unobstructed all the way to their own goal (H) - but Player 1's
    // path (bottom) is blocked by door A, which only plate a (on the TOP
    // corridor, reachable only by Player 2) can open. Player 2 has to
    // detour to the plate before heading to their own goal, or Player 1
    // is stuck down there forever.
    rows: [
      '###############',
      '#12   a      H#',
      '#.#############',
      '#   A       G #',
      '###############',
    ],
  },
]

export const LEVELS = RAW_LEVELS.map((level) => ({
  name: level.name,
  ...parseLevel(level.rows),
}))
