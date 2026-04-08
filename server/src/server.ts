import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateRoom, removePlayer, getRoom, resetGame } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Serve static client files in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// ── OAuth2 Token Exchange ─────────────────────────────────────────────────────

app.post('/api/token', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Missing code' });
    return;
  }

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
      }),
    });

    const data = await response.json();
    if (data.error) {
      res.status(400).json({ error: data.error });
      return;
    }

    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('[Token Exchange] Error:', err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// ── Socket.io Game Relay ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let currentChannelId: string | null = null;

  socket.on('room:join', ({ channelId, userId, username }) => {
    currentChannelId = channelId;
    socket.join(channelId);

    const room = getOrCreateRoom(channelId, { userId, username, socketId: socket.id });

    // Send current state to the joiner
    io.to(channelId).emit('players:update', {
      players: room.players.map((p) => ({ userId: p.userId, username: p.username })),
      hostId: room.hostId,
    });

    // If game already started, tell the late joiner
    if (room.gameStarted) {
      socket.emit('game:already-started');
    }

    console.log(`[Room ${channelId}] ${username} joined (${room.players.length} players, host: ${room.hostId})`);
  });

  socket.on('game:start', ({ channelId, settings, playerNames }) => {
    const room = getRoom(channelId);
    if (!room) return;
    room.gameStarted = true;
    io.to(channelId).emit('game:started', { settings, playerNames });
  });

  socket.on('card:draw', ({ channelId, drawnCard }) => {
    // Relay to everyone except the host who sent it
    socket.to(channelId).emit('card:update', { drawnCard });
  });

  socket.on('answer:reveal', ({ channelId }) => {
    socket.to(channelId).emit('answer:revealed');
  });

  socket.on('rules:update', ({ channelId, activeRules }) => {
    socket.to(channelId).emit('rules:update', { activeRules });
  });

  socket.on('game:end', ({ channelId, totalRounds }) => {
    const room = getRoom(channelId);
    if (room) resetGame(channelId);
    io.to(channelId).emit('game:ended', { totalRounds });
  });

  socket.on('disconnect', () => {
    if (!currentChannelId) return;
    const { room, hostChanged } = removePlayer(currentChannelId, socket.id);
    if (!room || room.players.length === 0) return;

    io.to(currentChannelId).emit('players:update', {
      players: room.players.map((p) => ({ userId: p.userId, username: p.username })),
      hostId: room.hostId,
    });

    if (hostChanged) {
      io.to(currentChannelId).emit('host:changed', { newHostId: room.hostId });
      console.log(`[Room ${currentChannelId}] Host changed to ${room.hostId}`);
    }
  });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`[JARTD Discord] Server running on port ${PORT}`);
});
