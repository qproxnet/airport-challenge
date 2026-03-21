require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const path       = require('path');

const authRoutes  = require('./routes/auth');
const GameEngine  = require('./game/GameEngine');
const { LEVELS }  = require('./game/levels');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

app.get('/api/levels', (_req, res) => {
  res.json({
    levels: Object.values(LEVELS).map(l => ({
      id:                 l.id,
      name:               l.name,
      description:        l.description,
      requiredScore:      l.requiredScore,
      passingScore:       l.passingScore,
      unlockRequirement:  l.unlockRequirement
    }))
  });
});

// Catch-all: serve SPA
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/index.html'))
);

// ── Socket.io auth middleware ─────────────────────────────────────────────────
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) throw new Error('No token');
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
});

// ── Game rooms ────────────────────────────────────────────────────────────────
const gameRooms = new Map(); // roomId → GameEngine

io.on('connection', socket => {
  const { username, userId } = socket.user;
  console.log(`[+] ${username} connected (${socket.id})`);

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId, levelId }) => {
    const level = LEVELS[levelId] || LEVELS[1];

    // Leave any previous room
    for (const r of socket.rooms) {
      if (r !== socket.id) {
        socket.leave(r);
        const prev = gameRooms.get(r);
        if (prev) {
          prev.removePlayer(userId);
          io.to(r).emit('player_left', { username, players: prev.getPlayers() });
          if (prev.getPlayers().length === 0) { prev.stop(); gameRooms.delete(r); }
        }
      }
    }

    socket.join(roomId);
    socket.currentRoom = roomId;

    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, new GameEngine(level, roomId, io));
      console.log(`[+] Room created: ${roomId} (L${levelId})`);
    }

    const engine = gameRooms.get(roomId);
    engine.addPlayer(userId, username);
    socket.emit('game_state', engine.getState());
    io.to(roomId).emit('player_joined', { username, players: engine.getPlayers() });
  });

  // ── start_game ─────────────────────────────────────────────────────────────
  socket.on('start_game', () => {
    const engine = gameRooms.get(socket.currentRoom);
    if (!engine || engine.state !== 'lobby') return;
    engine.start();
    io.to(socket.currentRoom).emit('game_started');
  });

  // ── player commands ────────────────────────────────────────────────────────
  const cmd = (fn) => (...args) => {
    const engine = gameRooms.get(socket.currentRoom);
    if (!engine) return;
    const res = fn(engine, ...args);
    if (res && !res.success) socket.emit('cmd_error', { message: res.message });
  };

  socket.on('cmd_land',      cmd((e, { planeId }) => e.commandLand(planeId)));
  socket.on('cmd_hold',      cmd((e, { planeId }) => e.commandHold(planeId)));
  socket.on('cmd_takeoff',   cmd((e, { planeId }) => e.commandTakeoff(planeId)));
  socket.on('cmd_depart',    cmd((e, { planeId }) => e.commandDepart(planeId)));
  socket.on('cmd_go_around', cmd((e, { planeId }) => e.commandGoAround(planeId)));

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${username} disconnected`);
    const roomId = socket.currentRoom;
    if (!roomId) return;
    const engine = gameRooms.get(roomId);
    if (!engine) return;
    engine.removePlayer(userId);
    io.to(roomId).emit('player_left', { username, players: engine.getPlayers() });
    if (engine.getPlayers().length === 0) {
      engine.stop();
      gameRooms.delete(roomId);
      console.log(`[-] Room deleted: ${roomId}`);
    }
  });
});

// ── DB + listen ───────────────────────────────────────────────────────────────
const PORT      = process.env.PORT      || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/airportchallenge';

mongoose.connect(MONGO_URI)
  .then(() => console.log('[DB] MongoDB connected'))
  .catch(err => console.warn('[DB] MongoDB unavailable — running without persistence:', err.message));

server.listen(PORT, () => console.log(`[SERVER] Listening on http://localhost:${PORT}`));
