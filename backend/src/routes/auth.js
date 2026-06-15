const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
require('dotenv').config();

// ── POST /api/auth/login ──────────────────────
router.post('/login', async (req, res) => {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe)
    return res.status(400).json({ message: 'Email et mot de passe requis' });

  try {
    const { rows } = await query(
      'SELECT * FROM utilisateurs WHERE email = $1 AND actif = true',
      [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ message: 'Identifiants incorrects' });

    const user = rows[0];
    if (!(await bcrypt.compare(mot_de_passe, user.mot_de_passe)))
      return res.status(401).json({ message: 'Identifiants incorrects' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role,
        nom: user.nom, prenom: user.prenom, direction: user.direction },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      utilisateur: {
        id: user.id, nom: user.nom, prenom: user.prenom,
        email: user.email, role: user.role, direction: user.direction,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/moi ─────────────────────────
router.get('/moi', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, nom, prenom, email, role, direction FROM utilisateurs WHERE id = $1',
      [req.utilisateur.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/utilisateurs (admin) ───────
router.get('/utilisateurs', authMiddleware, async (req, res) => {
  if (req.utilisateur.role !== 'admin')
    return res.status(403).json({ message: 'Réservé aux administrateurs' });
  try {
    const { rows } = await query(
      'SELECT id, nom, prenom, email, role, direction, actif, created_at FROM utilisateurs ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/utilisateurs (admin) ──────
router.post('/utilisateurs', authMiddleware, async (req, res) => {
  if (req.utilisateur.role !== 'admin')
    return res.status(403).json({ message: 'Réservé aux administrateurs' });

  const { nom, prenom, email, mot_de_passe, role, direction } = req.body;
  if (!nom || !prenom || !email || !mot_de_passe)
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  if (mot_de_passe.length < 6)
    return res.status(400).json({ message: '6 caractères minimum' });

  try {
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const { rows } = await query(
      `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, direction)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, nom, prenom, email, role, direction, actif`,
      [nom, prenom, email, hash, role || 'agent', direction || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ message: 'Email déjà utilisé' });
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/auth/utilisateurs/:id/toggle (admin) ──
router.patch('/utilisateurs/:id/toggle', authMiddleware, async (req, res) => {
  if (req.utilisateur.role !== 'admin')
    return res.status(403).json({ message: 'Réservé aux administrateurs' });
  if (req.params.id === req.utilisateur.id)
    return res.status(400).json({ message: 'Impossible de désactiver votre propre compte' });
  try {
    const { rows } = await query(
      'UPDATE utilisateurs SET actif = NOT actif WHERE id = $1 RETURNING id, nom, prenom, email, role, actif',
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
