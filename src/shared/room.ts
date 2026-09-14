export const ROOM_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  return Array.from({ length: 4 }, () => {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length)
    return ROOM_CODE_CHARACTERS[index]
  }).join('')
}

export function normalizeRoomCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function isValidRoomCode(roomCode: string): boolean {
  return roomCode.length === 4 && [...roomCode].every((character) =>
    ROOM_CODE_CHARACTERS.includes(character),
  )
}

export function normalizePlayerName(value: string): string {
  return value.trim()
}

export function isValidPlayerName(playerName: string): boolean {
  return playerName.length >= 2 && playerName.length <= 20
}
