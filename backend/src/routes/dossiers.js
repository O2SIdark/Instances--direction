require('dotenv').config();
const router = require('express').Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { query } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { envoyerAlerteEmail, envoyerEmailValidation } = require('../services/emailService');

// ── Config Multer local en mémoire (Memory Storage) ──
// Cette configuration supprime définitivement 'multer-storage-cloudinary'
// Elle stocke le fichier temporairement dans la RAM avant de l'envoyer à Cloudinary.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10 Mo
  fileFilter: (req, file, cb) => {
    const typesOK = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
    ];
    if (typesOK.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé (PDF, Word, Images seulement)'));
    }
  },
});

router.use(authMiddleware);

// ────────────────────────────────────────────────────────
// GET /api/dossiers — liste avec filtres
// ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { statut, instance, recherche } = req.query;

    let sql = `
      SELECT
        d.*,
        u.nom    AS createur_nom,
        u.prenom AS createur_prenom,
        COUNT(DISTINCT i.id)  AS nb_intervenants,
        COUNT(DISTINCT t.id)  AS nb_taches,
        COUNT(DISTINCT a.id) FILTER (WHERE a.est_lue = false) AS nb_alertes
      FROM dossiers d
      LEFT JOIN utilisateurs u ON u.id = d.cree_par
      LEFT JOIN intervenants i ON i.dossier_id = d.id
      LEFT JOIN taches t       ON t.dossier_id = d.id
      LEFT JOIN alertes a      ON a.dossier_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (statut) {
      params.push(statut);
      sql += ` AND d.statut = $${params.length}`;
    }
    if (instance) {
      params.push(instance);
      sql += ` AND d.instance = $${params.length}`;
    }
    if (recherche) {
      params.push(`%${recherche}%`);
      sql += ` AND (
        d.objet     ILIKE $${params.length} OR
        d.reference ILIKE $${params.length}
      )`;
    }

    sql += `
      GROUP BY d.id, u.nom, u.prenom
      ORDER BY d.created_at DESC
    `;

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /dossiers:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// GET /api/dossiers/export/csv
// IMPORTANT : cette route DOIT être avant /:id
// ────────────────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        d.reference,
        d.objet,
        d.instance,
        TO_CHAR(d.date_limite, 'DD/MM/YYYY')         AS date_limite,
        d.statut,
        d.niveau_mise_en_oeuvre || '%'                AS avancement,
        TO_CHAR(d.created_at, 'DD/MM/YYYY')           AS date_creation,
        TO_CHAR(d.date_fin_effective, 'DD/MM/YYYY')   AS date_cloture,
        COALESCE(u.prenom, '') || ' ' ||
          COALESCE(u.nom, '')                         AS createur,
        COALESCE(d.valide_par_nom, '')                AS valide_par,
        COUNT(DISTINCT i.id)                          AS nb_intervenants,
        COALESCE(d.description, '')                   AS description
      FROM dossiers d
      LEFT JOIN utilisateurs u ON u.id = d.cree_par
      LEFT JOIN intervenants i ON i.dossier_id = d.id
      GROUP BY d.id, u.prenom, u.nom
      ORDER BY d.created_at DESC
    `);

    const entetes = [
      'Référence', 'Objet', 'Instance', 'Date limite',
      'Statut', 'Avancement', 'Date création', 'Date clôture',
      'Créé par', 'Validé par', 'Nb intervenants', 'Description',
    ];

    const lignes = rows.map(r => [
      r.reference,
      `"${(r.objet || '').replace(/"/g, '""')}"`,
      r.instance,
      r.date_limite   || '',
      r.statut,
      r.avancement,
      r.date_creation || '',
      r.date_cloture  || '',
      `"${(r.createur || '').trim()}"`,
      `"${(r.valide_par || '')}"`,
      r.nb_intervenants,
      `"${(r.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ].join(';'));

    // BOM UTF-8 pour que Excel affiche correctement les accents
    const csv = '\uFEFF' + [entetes.join(';'), ...lignes].join('\r\n');

    const nomFichier = `dossiers_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /export/csv:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// GET /api/dossiers/:id — détail complet
// ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: dossiers } = await query(`
      SELECT
        d.*,
        u.nom    AS createur_nom,
        u.prenom AS createur_prenom
      FROM dossiers d
      LEFT JOIN utilisateurs u ON u.id = d.cree_par
      WHERE d.id = $1
    `, [req.params.id]);

    if (dossiers.length === 0)
      return res.status(404).json({ message: 'Dossier introuvable' });

    const [ivs, taches, alertes] = await Promise.all([
      query(
        'SELECT * FROM intervenants WHERE dossier_id = $1 ORDER BY nom',
        [req.params.id]
      ),
      query(
        `SELECT * FROM taches
         WHERE dossier_id = $1
         ORDER BY date_echeance NULLS LAST`,
        [req.params.id]
      ),
      query(
        `SELECT * FROM alertes
         WHERE dossier_id = $1
         ORDER BY created_at DESC`,
        [req.params.id]
      ),
    ]);

    res.json({
      ...dossiers[0],
      fichiers:     dossiers[0].fichiers     || [],
      intervenants: ivs.rows,
      taches:       taches.rows,
      alertes:      alertes.rows,
    });
  } catch (err) {
    console.error('GET /dossiers/:id:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// POST /api/dossiers — créer
// ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    reference, objet, instance, date_limite,
    niveau_mise_en_oeuvre, description, intervenants,
  } = req.body;

  if (!reference || !objet || !instance || !date_limite)
    return res.status(400).json({
      message: 'Référence, objet, instance et date limite sont requis',
    });

  try {
    const niv = parseInt(niveau_mise_en_oeuvre) || 0;
    let statut = 'Initié';
    if (niv === 100) statut = 'Bouclé';
    else if (niv > 0) statut = 'En cours';

    const { rows } = await query(`
      INSERT INTO dossiers
        (reference, objet, instance, date_limite,
         statut, niveau_mise_en_oeuvre, description,
         cree_par, cree_par_email, fichiers)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'[]')
      RETURNING *
    `, [
      reference, objet, instance, date_limite,
      statut, niv,
      description || '',
      req.utilisateur.id,
      req.utilisateur.email,
    ]);

    const dossier = rows[0];

    // Ajouter les intervenants
    if (Array.isArray(intervenants)) {
      for (const iv of intervenants) {
        if (iv.nom && iv.nom.trim()) {
          await query(`
            INSERT INTO intervenants
              (dossier_id, nom, role, direction, email, avancement)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [
            dossier.id,
            iv.nom.trim(),
            iv.role      || 'Intervenant',
            iv.direction || '',
            iv.email     || '',
            parseInt(iv.avancement) || 0,
          ]);
        }
      }
    }

    res.status(201).json(dossier);
  } catch (err) {
    console.error('POST /dossiers:', err.message);
    if (err.code === '23505')
      return res.status(409).json({ message: 'Cette référence existe déjà' });
    res.status(400).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// POST /api/dossiers/:id/fichiers — upload direct Cloudinary (Buffer)
// ────────────────────────────────────────────────────────
router.post(
  '/:id/fichiers',
  (req, res, next) => {
    upload.single('fichier')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE')
          return res.status(400).json({ message: 'Fichier trop lourd (max 10 Mo)' });
        return res.status(400).json({ message: err.message });
      }
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: 'Aucun fichier reçu' });

    try {
      const { rows } = await query(
        'SELECT fichiers FROM dossiers WHERE id = $1',
        [req.params.id]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: 'Dossier introuvable' });

      const fichiers = Array.isArray(rows[0].fichiers) ? rows[0].fichiers : [];

      // Génération d'un nom de fichier sécurisé pour Cloudinary
      const originalClean = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniquePublicId = `${Date.now()}_${originalClean}`;

      // Utilisation d'un uploadStream pour téléverser le buffer de mémoire directement vers Cloudinary
      const uploadToCloudinary = (fileBuffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'instances-direction',
              resource_type: 'auto',
              public_id: uniquePublicId
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          stream.end(fileBuffer);
        });
      };

      // Exécution de l'upload vers Cloudinary
      const uploadResult = await uploadToCloudinary(req.file.buffer);

      const nouveau = {
        nom:        req.file.originalname,
        nomServeur: uploadResult.public_id, // public_id Cloudinary pour future suppression
        taille:     req.file.size,
        type:       req.file.mimetype,
        url:        uploadResult.secure_url, // URL HTTPS directe Cloudinary
        date:       new Date().toISOString(),
        ajoute_par: `${req.utilisateur.prenom} ${req.utilisateur.nom}`,
      };

      fichiers.push(nouveau);

      await query(
        `UPDATE dossiers SET fichiers = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(fichiers), req.params.id]
      );

      res.json({ message: 'Fichier ajouté avec succès', fichier: nouveau });
    } catch (err) {
      console.error('POST /fichiers:', err.message);
      res.status(500).json({ message: err.message });
    }
  }
);

// ────────────────────────────────────────────────────────
// DELETE /api/dossiers/:id/fichiers/:nomServeur
// ────────────────────────────────────────────────────────
router.delete('/:id/fichiers/:nomServeur', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT fichiers FROM dossiers WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Dossier introuvable' });

    const fichiers = Array.isArray(rows[0].fichiers) ? rows[0].fichiers : [];
    const nouveaux = fichiers.filter(f => f.nomServeur !== req.params.nomServeur);

    // Supprimer sur Cloudinary grâce au public_id (nomServeur)
    try {
      await cloudinary.uploader.destroy(req.params.nomServeur, { resource_type: 'auto' });
    } catch (cloudErr) {
      console.error('Suppression Cloudinary:', cloudErr.message);
      // On continue même si Cloudinary échoue, pour ne pas désynchroniser la DB
    }

    await query(
      `UPDATE dossiers SET fichiers = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(nouveaux), req.params.id]
    );

    res.json({ message: 'Fichier supprimé' });
  } catch (err) {
    console.error('DELETE /fichiers:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// PATCH /api/dossiers/:id/valider — validation admin/créateur
// ────────────────────────────────────────────────────────
router.patch('/:id/valider', async (req, res) => {
  const userId = req.utilisateur.id;
  const role   = req.utilisateur.role;

  try {
    const { rows } = await query(
      'SELECT * FROM dossiers WHERE id = $1',
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'Dossier introuvable' });

    const dossier = rows[0];

    // Vérification des droits
    if (role !== 'admin' && dossier.cree_par !== userId) {
      return res.status(403).json({
        message: "Seul l'administrateur ou le créateur peut valider ce dossier.",
      });
    }

    if (dossier.statut === 'Bouclé')
      return res.status(400).json({ message: 'Ce dossier est déjà bouclé' });

    const nomValideur = `${req.utilisateur.prenom} ${req.utilisateur.nom}`;

    // Mise à jour
    const { rows: updated } = await query(`
      UPDATE dossiers SET
        statut                = 'Bouclé',
        niveau_mise_en_oeuvre = 100,
        date_fin_effective    = CURRENT_DATE,
        valide_par            = $1,
        valide_par_nom        = $2,
        date_validation       = NOW(),
        updated_at            = NOW()
      WHERE id = $3
      RETURNING *
    `, [userId, nomValideur, req.params.id]);

    // Enregistrer une alerte de validation
    await query(`
      INSERT INTO alertes
        (dossier_id, reference, objet, type, message, priorite, responsable)
      VALUES ($1, $2, $3, 'validation', $4, 'Info', $5)
    `, [
      req.params.id,
      dossier.reference,
      dossier.objet,
      `Dossier validé et bouclé par ${nomValideur}.`,
      nomValideur,
    ]);

    // Envoyer emails aux intervenants
    const { rows: ivs } = await query(
      `SELECT * FROM intervenants
       WHERE dossier_id = $1
         AND email IS NOT NULL
         AND email != ''`,
      [req.params.id]
    );

    for (const iv of ivs) {
      try {
        await envoyerEmailValidation({
          destinataire: iv.email,
          dossier:      dossier.reference,
          objet:        dossier.objet,
          validePar:    nomValideur,
        });
      } catch (emailErr) {
        // L'email échoue silencieusement, la validation continue
        console.error('Email validation:', emailErr.message);
      }
    }

    console.log(
      `✅ Dossier ${dossier.reference} validé par ${nomValideur}`,
      ivs.length > 0
        ? `— ${ivs.length} email(s) envoyé(s)`
        : '— aucun email (pas de destinataires)'
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('PATCH /valider:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// PUT /api/dossiers/:id — modifier
// ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const {
    objet, instance, date_limite,
    niveau_mise_en_oeuvre, description,
  } = req.body;

  try {
    const { rows: old } = await query(
      'SELECT * FROM dossiers WHERE id = $1',
      [req.params.id]
    );
    if (old.length === 0)
      return res.status(404).json({ message: 'Dossier introuvable' });

    const niv  = niveau_mise_en_oeuvre != null
      ? parseInt(niveau_mise_en_oeuvre)
      : old[0].niveau_mise_en_oeuvre;
    const dlim = date_limite || old[0].date_limite;

    let statut = old[0].statut;
    if (statut !== 'Bouclé') {
      if (niv === 100)                          statut = 'Bouclé';
      else if (new Date(dlim) < new Date())     statut = 'En retard';
      else if (niv > 0)                         statut = 'En cours';
      else                                      statut = 'Initié';
    }

    const { rows } = await query(`
      UPDATE dossiers SET
        objet                 = COALESCE($1, objet),
        instance              = COALESCE($2, instance),
        date_limite           = COALESCE($3, date_limite),
        niveau_mise_en_oeuvre = $4,
        description           = COALESCE($5, description),
        statut                = $6,
        date_fin_effective    = CASE
          WHEN $6 = 'Bouclé' AND date_fin_effective IS NULL
          THEN CURRENT_DATE ELSE date_fin_effective
        END,
        updated_at            = NOW()
      WHERE id = $7
      RETURNING *
    `, [objet, instance, date_limite, niv, description, statut, req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /dossiers/:id:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// DELETE /api/dossiers/:id — supprimer (admin ou créateur)
// ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM dossiers WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Dossier introuvable' });

    if (
      req.utilisateur.role !== 'admin' &&
      rows[0].cree_par !== req.utilisateur.id
    ) {
      return res.status(403).json({
        message: 'Seul le créateur ou un administrateur peut supprimer.',
      });
    }

    await query('DELETE FROM dossiers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Dossier supprimé avec succès' });
  } catch (err) {
    console.error('DELETE /dossiers/:id:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
