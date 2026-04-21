import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3001);
const MAX_HP = 100;
const DAMAGE = 25;

const SPAWN_POINTS = [
  { x: 14, y: 1.7, z: 14 },
  { x: -14, y: 1.7, z: 14 },
  { x: 14, y: 1.7, z: -14 },
  { x: -14, y: 1.7, z: -14 },
  { x: 0, y: 1.7, z: 14 },
  { x: 0, y: 1.7, z: -14 },
];

const NAME_PREFIXES = ['Neo', 'Vex', 'Zyn', 'Kai', 'Rix', 'Lux', 'Nyx', 'Orb', 'Pyx', 'Quill'];
const NAME_SUFFIXES = ['-01', '-7', '-X', '-9', '-42', '-K', '-R', '-Z'];

function randomName() {
  const p = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const s = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  return `${p}${s}`;
}

function randomSpawn() {
  return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true, players: players.size }));

const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const players = new Map();

function playerSnapshot() {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    yaw: p.yaw,
    pitch: p.pitch,
  }));
}

function scoreboard() {
  return Array.from(players.values())
    .map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}

function broadcastScoreboard() {
  io.emit('scoreboard', { list: scoreboard() });
}

io.on('connection', (socket) => {
  const spawn = randomSpawn();
  const player = {
    id: socket.id,
    name: randomName(),
    position: { ...spawn },
    yaw: 0,
    pitch: 0,
    hp: MAX_HP,
    kills: 0,
    deaths: 0,
  };
  players.set(socket.id, player);

  const others = playerSnapshot().filter((p) => p.id !== socket.id);
  socket.emit('welcome', {
    id: socket.id,
    name: player.name,
    spawn,
    players: others,
    scoreboard: scoreboard(),
  });
  socket.broadcast.emit('player:join', {
    id: player.id,
    name: player.name,
    position: player.position,
    yaw: player.yaw,
    pitch: player.pitch,
  });
  broadcastScoreboard();

  socket.on('state', (s) => {
    const p = players.get(socket.id);
    if (!p || !s) return;
    if (typeof s.x === 'number') p.position.x = s.x;
    if (typeof s.y === 'number') p.position.y = s.y;
    if (typeof s.z === 'number') p.position.z = s.z;
    if (typeof s.yaw === 'number') p.yaw = s.yaw;
    if (typeof s.pitch === 'number') p.pitch = s.pitch;
  });

  socket.on('fire', (shot) => {
    if (!shot) return;
    socket.broadcast.emit('fire', { ...shot, from: socket.id });

    if (!shot.hitId) return;
    const victim = players.get(shot.hitId);
    const shooter = players.get(socket.id);
    if (!victim || !shooter || victim.id === shooter.id || victim.hp <= 0) return;

    const damage = shot.explosive ? MAX_HP : DAMAGE;
    victim.hp = Math.max(0, victim.hp - damage);

    if (victim.hp <= 0) {
      shooter.kills += 1;
      victim.deaths += 1;

      const newSpawn = randomSpawn();
      victim.position = { ...newSpawn };
      victim.hp = MAX_HP;

      io.emit('death', { victim: victim.id, killer: shooter.id });
      io.to(victim.id).emit('respawn', { spawn: newSpawn, hp: MAX_HP });
      broadcastScoreboard();
    }
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('player:leave', { id: socket.id });
    broadcastScoreboard();
  });
});

const SNAPSHOT_INTERVAL = 1000 / 20;
setInterval(() => {
  if (players.size === 0) return;
  io.emit('players', { list: playerSnapshot() });
}, SNAPSHOT_INTERVAL);

httpServer.listen(PORT, () => {
  console.log(`[shooter-server] listening on http://localhost:${PORT}`);
});
