import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  // Connect to same origin (server serves both static files and Socket.io)
  socket = io({ transports: ['websocket', 'polling'] });
  return socket;
}

export function getSocket(): Socket {
  if (!socket) throw new Error('Socket not connected');
  return socket;
}

export function joinRoom(channelId: string, userId: string, username: string) {
  getSocket().emit('room:join', { channelId, userId, username });
}

export function emitGameStart(channelId: string, settings: any, playerNames: string[]) {
  getSocket().emit('game:start', { channelId, settings, playerNames });
}

export function emitCardDraw(channelId: string, drawnCard: any) {
  getSocket().emit('card:draw', { channelId, drawnCard });
}

export function emitAnswerReveal(channelId: string) {
  getSocket().emit('answer:reveal', { channelId });
}

export function emitRulesUpdate(channelId: string, activeRules: any[]) {
  getSocket().emit('rules:update', { channelId, activeRules });
}

export function emitGameEnd(channelId: string, totalRounds: number) {
  getSocket().emit('game:end', { channelId, totalRounds });
}

export function onPlayersUpdate(callback: (data: { players: Array<{ userId: string; username: string }>; hostId: string }) => void) {
  getSocket().on('players:update', callback);
}

export function onGameStarted(callback: (data: { settings: any; playerNames: string[] }) => void) {
  getSocket().on('game:started', callback);
}

export function onCardUpdate(callback: (data: { drawnCard: any }) => void) {
  getSocket().on('card:update', callback);
}

export function onAnswerRevealed(callback: () => void) {
  getSocket().on('answer:revealed', callback);
}

export function onRulesUpdate(callback: (data: { activeRules: any[] }) => void) {
  getSocket().on('rules:update', callback);
}

export function onGameEnded(callback: (data: { totalRounds: number }) => void) {
  getSocket().on('game:ended', callback);
}

export function onHostChanged(callback: (data: { newHostId: string }) => void) {
  getSocket().on('host:changed', callback);
}

export function onGameAlreadyStarted(callback: () => void) {
  getSocket().on('game:already-started', callback);
}
