const router = require('express').Router();
const { query }          = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { envoyerAlerteEmail } = require('../services/emailService');

router.use(authMiddleware);

// ── GET alertes (calculées + persistantes) ────────────────
router.get('/', async (req, res) => {
  try {
    const now    = new Date();
    const dans7j = new Date(now.getTime() + 7 * 86400000);

    // Alertes calculées dynamiquement
    const [enRetard, echeanceProche, sansIntervenants] = await Promise.all([
      query(`
        SELECT d.id, d.reference, d.objet, d.date_limite,
          (SELECT nom FROM intervenants
           WHERE dossier_id = d.id LIMIT 1) AS responsable
        FROM dossiers d
        WHERE d.statut IN ('En cours','Initié')
          AND d.date_limite < CURRENT_DATE
      `),
      query(`
        SELECT d.id, d.reference, d.objet, d.date_limite,
          (SELECT nom FROM intervenants
           WHERE dossier_id = d.id LIMIT 1) AS responsable
        FROM dossiers d
        WHERE d.statut IN ('En cours','Initié')
          AND d.date_limite BETWEEN CURRENT_DATE AND $1
      `, [dans7j.toISOString().split('T')[0]]),
      query(`
        SELECT d.id, d.reference, d.objet
        FROM dossiers d
        WHERE d.statut != 'Bouclé'
          AND NOT EXISTS (
            SELECT 1 FROM intervenants i
            WHERE i.dossier_id = d.id
          )
      `),
    ]);

    // Alertes persistantes (validations, etc.)
    const { rows: persistantes } = await query(`
      SELECT a.*, d.reference, d.objet
      FROM alertes a
      JOIN dossiers d ON d.id = a.dossier_id
      WHERE a.type = 'validation'
      ORDER BY a.created_at DESC
      LIMIT 20
    `);

    const alertes = [
      // Retards
      ...enRetard.rows.map(d => ({
        id:          `retard_${d.id}`,
        priorite:    'Critique',
        type:        'retard',
        dossier:     d.reference,
        objet:       d.objet,
        motif:       `Dépassement délai — ${
          Math.ceil((now - new Date(d.date_limite)) / 86400000)
        } jour(s)`,
        responsable: d.responsable || '—',
        dossier_id:  d.id,
        est_lue:     false,
      })),
      // Échéances proches
      ...echeanceProche.rows.map(d => ({
        id:          `echeance_${d.id}`,
        priorite:    'Modérée',
        type:        'echeance',
        dossier:     d.reference,
        objet:       d.objet,
        motif:       `Échéance dans ${
          Math.ceil((new Date(d.date_limite) - now) / 86400000)
        } jour(s)`,
        responsable: d.responsable || '—',
        dossier_id:  d.id,
        est_lue:     false,
      })),
      // Sans intervenants
      ...sansIntervenants.rows.map(d => ({
        id:          `sans_iv_${d.id}`,
        priorite:    'Info',
        type:        'sans_intervenant',
        dossier:     d.reference,
        objet:       d.objet,
        motif:       'Aucun intervenant assigné',
        responsable: '—',
        dossier_id:  d.id,
        est_lue:     false,
      })),
      // Validations récentes
      ...persistantes.map(a => ({
        id:          a.id,
        priorite:    'Info',
        type:        'validation',
        dossier:     a.reference,
        objet:       a.objet,
        motif:       a.message,
        responsable: a.responsable || '—',
        dossier_id:  a.dossier_id,
        est_lue:     a.est_lue,
        created_at:  a.created_at,
      })),
    ];

    res.json(alertes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST envoyer une alerte par email ─────────────────────
router.post('/envoyer-email', async (req, res) => {
  const { destinataire, priorite, dossier,
          objet, motif, responsable } = req.body;

  if (!destinataire || !dossier)
    return res.status(400).json({
      message: 'Destinataire et dossier requis',
    });

  const envoye = await envoyerAlerteEmail({
    destinataire, priorite, dossier, objet, motif, responsable,
  });

  res.json({
    success: envoye,
    message: envoye ? 'Email envoyé' : 'Échec envoi email',
  });
});

module.exports = router;
