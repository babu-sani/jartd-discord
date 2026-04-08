/** In-memory room management for JARTD Discord Activity. */

export interface Player {
  userId: string;
  username: string;
  socketId: string;
}

export interface Room {
  channelId: string;
  hostId: string;
  players: Player[];
  gameStarted: boolean;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

export function getOrCreateRoom(channelId: string, player: Player): Room {
  let room = rooms.get(channelId);
  if (!room) {
    room = {
      channelId,
      hostId: player.userId,
      players: [],
      gameStarted: false,
      cleanupTimer: null,
    };
    rooms.set(channelId, room);
  }

  // Cancel cleanup if someone is joining
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }

  // Add player if not already in room
  if (!room.players.find((p) => p.userId === player.userId)) {
    room.players.push(player);
  } else {
    // Update socket ID on reconnect
    const existing = room.players.find((p) => p.userId === player.userId)!;
    existing.socketId = player.socketId;
  }

  return room;
}

export function removePlayer(channelId: string, socketId: string): { room: Room | null; hostChanged: boolean } {
  const room = rooms.get(channelId);
  if (!room) return { room: null, hostChanged: false };

  room.players = room.players.filter((p) => p.socketId !== socketId);

  let hostChanged = false;

  // If host left, promote next player
  if (!room.players.find((p) => p.userId === room.hostId) && room.players.length > 0) {
    room.hostId = room.players[0].userId;
    hostChanged = true;
  }

  // If empty, schedule cleanup
  if (room.players.length === 0) {
    room.cleanupTimer = setTimeout(() => {
      rooms.delete(channelId);
    }, 30_000);
  }

  return { room, hostChanged };
}

export function getRoom(channelId: string): Room | undefined {
  return rooms.get(channelId);
}

export function resetGame(channelId: string) {
  const room = rooms.get(channelId);
  if (room) {
    room.gameStarted = false;
  }
}
