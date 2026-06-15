require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');
const { testerConnexion } = require('./services/emailService');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
app.use(express.json());
app.use(morgan('dev'));

// ── Servir les fichiers uploadés ──────────────────────────
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'))
);

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/dossiers',     require('./routes/dossiers'));
app.use('/api/intervenants', require('./routes/intervenants'));
app.use('/api/stats',        require('./routes/stats'));
app.use('/api/alertes',      require('./routes/alertes'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', message: 'API Instances Direction — Burkina Faso' })
);

app.use((req, res) =>
  res.status(404).json({ message: 'Route introuvable' })
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

// ── Démarrage ─────────────────────────────────────────────
const { pool } = require('./config/database');
pool.query('SELECT NOW()').then(async () => {
  app.listen(PORT, async () => {
    console.log(`🚀 Serveur sur http://localhost:${PORT}`);
    console.log('✅ PostgreSQL connecté');
    await testerConnexion();
  });
}).catch(err => {
  console.error('❌ PostgreSQL:', err.message);
  process.exit(1);
});
