const cron = require('node-cron');
const { query } = require('../config/database');
const { envoyerAlerteEmail } = require('./emailService');

// ── Vérification et envoi automatique des alertes ─────────
async function verifierEtEnvoyerAlertes() {
  const now    = new Date();
  const dans7j = new Date(now.getTime() + 7 * 86400000);

  try {
    // ── 1. Dossiers en retard (jamais notifiés dans les 24h) ──
    const { rows: enRetard } = await query(`
      SELECT d.id, d.reference, d.objet, d.date_limite,
        array_agg(DISTINCT i.email) FILTER (
          WHERE i.email IS NOT NULL AND i.email != ''
        ) AS emails,
        (SELECT nom FROM intervenants
         WHERE dossier_id = d.id LIMIT 1) AS responsable
      FROM dossiers d
      LEFT JOIN intervenants i ON i.dossier_id = d.id
      WHERE d.statut IN ('En cours','Initié')
        AND d.date_limite < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM alertes a
          WHERE a.dossier_id = d.id
            AND a.type = 'delai_depasse'
            AND a.created_at > NOW() - INTERVAL '24 hours'
        )
      GROUP BY d.id
    `);

    for (const d of enRetard) {
      const jours = Math.ceil((now - new Date(d.date_limite)) / 86400000);
      const motif = `Dépassement délai — ${jours} jour(s) de retard`;

      // Enregistrer l'alerte
      await query(`
        INSERT INTO alertes
          (dossier_id, reference, objet, type, message, priorite, responsable, email_envoye)
        VALUES ($1,$2,$3,'delai_depasse',$4,'Critique',$5,$6)
      `, [
        d.id, d.reference, d.objet, motif,
        d.responsable || '—',
        (d.emails && d.emails.length > 0),
      ]);

      // Envoyer email à chaque intervenant ayant un email
      if (d.emails && d.emails.length > 0) {
        for (const email of d.emails) {
          await envoyerAlerteEmail({
            destinataire: email,
            priorite:     'Critique',
            dossier:      d.reference,
            objet:        d.objet,
            motif,
            responsable:  d.responsable || '—',
          });
        }
      }
    }

    // ── 2. Échéances proches (≤ 7 jours, jamais notifiées dans les 24h) ──
    const { rows: echeanceProche } = await query(`
      SELECT d.id, d.reference, d.objet, d.date_limite,
        array_agg(DISTINCT i.email) FILTER (
          WHERE i.email IS NOT NULL AND i.email != ''
        ) AS emails,
        (SELECT nom FROM intervenants
         WHERE dossier_id = d.id LIMIT 1) AS responsable
      FROM dossiers d
      LEFT JOIN intervenants i ON i.dossier_id = d.id
      WHERE d.statut IN ('En cours','Initié')
        AND d.date_limite BETWEEN CURRENT_DATE AND $1
        AND NOT EXISTS (
          SELECT 1 FROM alertes a
          WHERE a.dossier_id = d.id
            AND a.type = 'echeance_proche'
            AND a.created_at > NOW() - INTERVAL '24 hours'
        )
      GROUP BY d.id
    `, [dans7j.toISOString().split('T')[0]]);

    for (const d of echeanceProche) {
      const jours = Math.ceil((new Date(d.date_limite) - now) / 86400000);
      const motif = `Échéance dans ${jours} jour(s)`;

      await query(`
        INSERT INTO alertes
          (dossier_id, reference, objet, type, message, priorite, responsable, email_envoye)
        VALUES ($1,$2,$3,'echeance_proche',$4,'Modérée',$5,$6)
      `, [
        d.id, d.reference, d.objet, motif,
        d.responsable || '—',
        (d.emails && d.emails.length > 0),
      ]);

      if (d.emails && d.emails.length > 0) {
        for (const email of d.emails) {
          await envoyerAlerteEmail({
            destinataire: email,
            priorite:     'Modérée',
            dossier:      d.reference,
            objet:        d.objet,
            motif,
            responsable:  d.responsable || '—',
          });
        }
      }
    }

    const total = enRetard.length + echeanceProche.length;
    if (total > 0) {
      console.log(
        ` Cron alertes : ${enRetard.length} retard(s), ` +
        `${echeanceProche.length} échéance(s) proche(s) — emails envoyés`
      );
    } else {
      console.log(' Cron alertes : aucune nouvelle alerte');
    }
  } catch (err) {
    console.error('x Erreur cron alertes:', err.message);
  }
}

// ── Démarrage du cron ──────────────────────────────────────
function demarrerCron() {
  // Vérification au démarrage du serveur
  verifierEtEnvoyerAlertes();

  // Puis toutes les heures (à la minute 0)
  cron.schedule('0 * * * *', () => {
    console.log(' Vérification automatique des alertes (cron horaire)...');
    verifierEtEnvoyerAlertes();
  });

  console.log(' Cron alertes démarré (vérification toutes les heures)');
}

module.exports = { demarrerCron, verifierEtEnvoyerAlertes };
