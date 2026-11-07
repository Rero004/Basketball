const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'match-data.json');

const VALID_STATES = ['hidden', 'pause', 'lineup_home', 'lineup_away', 'scorebug'];
const PERIODS = ['1Q', '2Q', '3Q', '4Q', 'OT'];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files and university logo folders
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/assets/ITSLP', express.static(path.join(__dirname, 'ITSLP')));
app.use('/assets/UASLP', express.static(path.join(__dirname, 'UASLP')));
app.use('/ITSLP', express.static(path.join(__dirname, 'ITSLP')));
app.use('/UASLP', express.static(path.join(__dirname, 'UASLP')));

function getDefaultData() {
  return {
    state: 'scorebug',
    period: '1Q',
    home: {
      acronym: 'ITS',
      name: 'ITSLP Ardillas',
      color: '#7A183E',
      logo: '/assets/ITSLP/ardilla.png',
      score: 0,
      players: [
        { number: '4', name: 'Carlos Mendoza', starter: true },
        { number: '7', name: 'Diego Ramírez', starter: true },
        { number: '10', name: 'Alejandro Torres', starter: true },
        { number: '12', name: 'Mateo Hernández', starter: true },
        { number: '23', name: 'Javier Morales', starter: true },
        { number: '1', name: 'Luis Fernando Gil', starter: false },
        { number: '8', name: 'Emiliano Castro', starter: false },
        { number: '15', name: 'Roberto Sánchez', starter: false }
      ]
    },
    away: {
      acronym: 'UAS',
      name: 'UASLP Águilas',
      color: '#1D9BF0',
      logo: '/assets/UASLP/Aguila.png',
      score: 0,
      players: [
        { number: '5', name: 'Sebastián Gómez', starter: true },
        { number: '9', name: 'Rodrigo Navarro', starter: true },
        { number: '11', name: 'Andrés Delgado', starter: true },
        { number: '14', name: 'Miguel Ángel Ruiz', starter: true },
        { number: '24', name: 'Santiago Flores', starter: true },
        { number: '2', name: 'Leonardo Silva', starter: false },
        { number: '6', name: 'Iván Castillo', starter: false },
        { number: '18', name: 'Jorge Domínguez', starter: false }
      ]
    }
  };
}

let matchData = getDefaultData();

function loadMatchData() {
  try {
    const tmpFile = path.join('/tmp', 'match-data.json');
    if (fs.existsSync(tmpFile)) {
      const raw = fs.readFileSync(tmpFile, 'utf8');
      matchData = { ...getDefaultData(), ...JSON.parse(raw) };
      return;
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      matchData = { ...getDefaultData(), ...parsed };
    } else {
      saveMatchData();
    }
  } catch (err) {
    console.error('Error loading match-data.json, using defaults:', err.message);
  }
}

function saveMatchData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(matchData, null, 2), 'utf8');
  } catch (err) {
    // Fallback for read-only serverless filesystems (e.g. Vercel)
    try {
      const tmpFile = path.join('/tmp', 'match-data.json');
      fs.writeFileSync(tmpFile, JSON.stringify(matchData, null, 2), 'utf8');
    } catch (e) {
      // In-memory fallback
    }
  }
}

function parseRawPlayers(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    // Soporta "Número - Nombre", "Número: Nombre", "#Número Nombre" o solo "Nombre"
    const dashMatch = line.match(/^#?(\d+)\s*[-–—:]\s*(.+)$/);
    if (dashMatch) {
      return {
        number: dashMatch[1].trim(),
        name: dashMatch[2].trim(),
        starter: index < 5
      };
    }
    const spaceMatch = line.match(/^#?(\d+)\s+(.+)$/);
    if (spaceMatch) {
      return {
        number: spaceMatch[1].trim(),
        name: spaceMatch[2].trim(),
        starter: index < 5
      };
    }
    return {
      number: String(index + 1),
      name: line,
      starter: index < 5
    };
  });
}

loadMatchData();

// Views
app.get('/', (req, res) => {
  res.redirect('/control');
});

app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get('/control', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'control.html'));
});

// Helper to handle both GET and POST for Stream Deck compatibility
function registerApiRoute(routePath, handler) {
  app.get(routePath, handler);
  app.post(routePath, handler);
}

// 1. /api/state?mode=pause|lineup_home|lineup_away|scorebug|hidden
registerApiRoute('/api/state', (req, res) => {
  const mode = req.query.mode || req.body?.mode;
  if (!VALID_STATES.includes(mode)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid mode. Valid modes: ${VALID_STATES.join(', ')}`
    });
  }

  matchData.state = mode;
  saveMatchData();
  io.emit('stateChange', { state: matchData.state, matchData });

  return res.json({ ok: true, state: matchData.state, matchData });
});

// 2. /api/score?team=home|away&points=1|2|3|-1
registerApiRoute('/api/score', (req, res) => {
  const team = req.query.team || req.body?.team;
  const points = parseInt(req.query.points ?? req.body?.points, 10);

  if (!['home', 'away'].includes(team)) {
    return res.status(400).json({ ok: false, error: 'Invalid team. Use home or away.' });
  }
  if (![1, 2, 3, -1].includes(points)) {
    return res.status(400).json({ ok: false, error: 'Invalid points. Use 1, 2, 3, or -1.' });
  }

  const prevScore = matchData[team].score || 0;
  const newScore = Math.max(0, prevScore + points);
  const actualDelta = newScore - prevScore;
  matchData[team].score = newScore;

  saveMatchData();

  const payload = {
    team,
    points,
    actualDelta,
    newScore,
    homeScore: matchData.home.score,
    awayScore: matchData.away.score,
    timestamp: Date.now()
  };

  io.emit('scoreUpdate', payload);
  return res.json({ ok: true, ...payload, matchData });
});

// 3. /api/period/next (and /api/period for direct selection)
registerApiRoute('/api/period/next', (req, res) => {
  const currentIndex = PERIODS.indexOf(matchData.period);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PERIODS.length;
  matchData.period = PERIODS[nextIndex];
  saveMatchData();

  io.emit('periodUpdate', { period: matchData.period, matchData });
  return res.json({ ok: true, period: matchData.period, matchData });
});

registerApiRoute('/api/period', (req, res) => {
  const period = req.query.period || req.body?.period;
  if (!PERIODS.includes(period)) {
    return res.status(400).json({ ok: false, error: `Invalid period. Valid: ${PERIODS.join(', ')}` });
  }
  matchData.period = period;
  saveMatchData();

  io.emit('periodUpdate', { period: matchData.period, matchData });
  return res.json({ ok: true, period: matchData.period, matchData });
});

// Additional API endpoints for Control Panel
app.get('/api/data', (req, res) => {
  res.json({ ok: true, matchData });
});

app.post('/api/rosters', (req, res) => {
  const { homeRaw, awayRaw, homeMeta, awayMeta } = req.body;

  if (typeof homeRaw === 'string') {
    matchData.home.players = parseRawPlayers(homeRaw);
  } else if (Array.isArray(req.body.homePlayers)) {
    matchData.home.players = req.body.homePlayers;
  }

  if (typeof awayRaw === 'string') {
    matchData.away.players = parseRawPlayers(awayRaw);
  } else if (Array.isArray(req.body.awayPlayers)) {
    matchData.away.players = req.body.awayPlayers;
  }

  if (homeMeta && typeof homeMeta === 'object') {
    if (homeMeta.name) matchData.home.name = homeMeta.name.trim();
    if (homeMeta.acronym) matchData.home.acronym = homeMeta.acronym.trim().substring(0, 3).toUpperCase();
    if (homeMeta.color) matchData.home.color = homeMeta.color;
    if (homeMeta.logo) matchData.home.logo = homeMeta.logo.trim();
  }

  if (awayMeta && typeof awayMeta === 'object') {
    if (awayMeta.name) matchData.away.name = awayMeta.name.trim();
    if (awayMeta.acronym) matchData.away.acronym = awayMeta.acronym.trim().substring(0, 3).toUpperCase();
    if (awayMeta.color) matchData.away.color = awayMeta.color;
    if (awayMeta.logo) matchData.away.logo = awayMeta.logo.trim();
  }

  saveMatchData();
  io.emit('rostersUpdated', { matchData });
  return res.json({ ok: true, matchData });
});

app.post('/api/reset-scores', (req, res) => {
  matchData.home.score = 0;
  matchData.away.score = 0;
  matchData.period = '1Q';
  saveMatchData();
  io.emit('matchState', matchData);
  return res.json({ ok: true, matchData });
});

// Socket.io real-time communication
io.on('connection', (socket) => {
  // Send initial state immediately upon connection
  socket.emit('matchState', matchData);

  socket.on('setState', (mode) => {
    if (VALID_STATES.includes(mode)) {
      matchData.state = mode;
      saveMatchData();
      io.emit('stateChange', { state: matchData.state, matchData });
    }
  });

  socket.on('updateScore', ({ team, points }) => {
    const pts = parseInt(points, 10);
    if (['home', 'away'].includes(team) && [1, 2, 3, -1].includes(pts)) {
      const prevScore = matchData[team].score || 0;
      const newScore = Math.max(0, prevScore + pts);
      const actualDelta = newScore - prevScore;
      matchData[team].score = newScore;
      saveMatchData();

      io.emit('scoreUpdate', {
        team,
        points: pts,
        actualDelta,
        newScore,
        homeScore: matchData.home.score,
        awayScore: matchData.away.score,
        timestamp: Date.now()
      });
    }
  });

  socket.on('setPeriod', (period) => {
    if (PERIODS.includes(period)) {
      matchData.period = period;
      saveMatchData();
      io.emit('periodUpdate', { period: matchData.period, matchData });
    }
  });

  socket.on('nextPeriod', () => {
    const currentIndex = PERIODS.indexOf(matchData.period);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PERIODS.length;
    matchData.period = PERIODS[nextIndex];
    saveMatchData();
    io.emit('periodUpdate', { period: matchData.period, matchData });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🏀 TECNM Basket Broadcast Server running on port ${PORT}`);
    console.log(`   ➤ OBS Overlay (1920x1080): http://localhost:${PORT}/overlay`);
    console.log(`   ➤ Control Panel:           http://localhost:${PORT}/control`);
    console.log(`====================================================`);
  });
}

module.exports = app;
