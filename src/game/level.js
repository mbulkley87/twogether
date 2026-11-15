// A level is plain text rows, one character per tile:
//   # = wall (always solid)
//   (space) = open air
//   1 / 2 = Player 1 / Player 2 spawn point
//   G / H = Player 1 / Player 2 goal zone
//   a-z = a pressure plate (non-solid, steppable)
//   A-Z = the door tiles linked to the SAME letter's plate - solid while
//         nothing is on that plate, open (non-solid) while something is.
//         G and H are reserved for goals, never used as a door letter.
export function parseLevel(rows) {
  const grid = rows.map((row) => row.split(''))
  const height = grid.length
  const width = grid[0].length

  const solid = new Set()
  const plates = {}
  const doors = {}
  let spawn1 = null
  let spawn2 = null
  let goal1 = null
  let goal2 = null

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[y][x]
      if (ch === '#') {
        solid.add(`${x},${y}`)
      } else if (ch === '1') {
        spawn1 = { x, y }
      } else if (ch === '2') {
        spawn2 = { x, y }
      } else if (ch === 'G') {
        goal1 = { x, y }
      } else if (ch === 'H') {
        goal2 = { x, y }
      } else if (ch >= 'a' && ch <= 'z') {
        plates[ch] = { x, y }
      } else if (ch >= 'A' && ch <= 'Z' && ch !== 'G' && ch !== 'H') {
        const letter = ch.toLowerCase()
        doors[letter] = doors[letter] || []
        doors[letter].push({ x, y })
      }
    }
  }

  if (!spawn1 || !spawn2) throw new Error('Level is missing a "1" or "2" spawn point')
  if (!goal1 || !goal2) throw new Error('Level is missing a "G" or "H" goal zone')

  return { width, height, solid, plates, doors, spawn1, spawn2, goal1, goal2 }
}
