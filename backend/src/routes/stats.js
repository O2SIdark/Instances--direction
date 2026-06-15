const router = require('express').Router();
const { query } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [totaux, parInstance, parStatut] = await Promise.all([
      query(`
        SELECT
          COUNT(*)                                               AS total,
          COUNT(*) FILTER (WHERE statut = 'Bouclé')             AS boucles,
          COUNT(*) FILTER (WHERE statut = 'En cours')           AS en_cours,
          COUNT(*) FILTER (WHERE statut = 'En retard')          AS en_retard,
          COUNT(*) FILTER (WHERE statut = 'Initié')             AS inities,
          COALESCE(ROUND(AVG(
            CASE WHEN statut = 'Bouclé'
                  AND date_fin_effective <= date_limite
            THEN 100 ELSE 0 END
          )), 0) AS taux_delais,
          COUNT(*) FILTER (
            WHERE statut = 'Bouclé'
            AND date_fin_effective <= date_limite
          ) AS boucles_dans_delais
        FROM dossiers
      `),
      query(`
        SELECT instance AS "_id", COUNT(*) AS count
        FROM dossiers
        GROUP BY instance ORDER BY count DESC
      `),
      query(`
        SELECT statut AS "_id", COUNT(*) AS count
        FROM dossiers GROUP BY statut
      `),
    ]);

    res.json({
      ...totaux.rows[0],
      parInstance: parInstance.rows,
      parStatut:   parStatut.rows,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
