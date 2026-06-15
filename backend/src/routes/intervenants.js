const router = require('express').Router();
const { query } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM intervenants ORDER BY nom'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  const { dossier_id, nom, role, direction, email, avancement } = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO intervenants (dossier_id, nom, role, direction, email, avancement)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dossier_id, nom, role || 'Intervenant',
       direction || '', email || '', avancement || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { nom, role, direction, email, avancement } = req.body;
  try {
    const { rows } = await query(
      `UPDATE intervenants SET
         nom = COALESCE($1, nom),
         role = COALESCE($2, role),
         direction = COALESCE($3, direction),
         email = COALESCE($4, email),
         avancement = COALESCE($5, avancement)
       WHERE id = $6 RETURNING *`,
      [nom, role, direction, email, avancement, req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Intervenant introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM intervenants WHERE id = $1', [req.params.id]);
    res.json({ message: 'Intervenant supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
