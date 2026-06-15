require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Comptes utilisateurs ──────────────────────────
    const hashAdmin = await bcrypt.hash('admin123', 10);
    const { rows: [admin] } = await client.query(`
      INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, direction)
      VALUES ('ADMINISTRATEUR', 'Système',
        'admin@univ-burkina.bf', $1, 'admin', 'Direction Générale')
      ON CONFLICT (email) DO UPDATE SET mot_de_passe = $1
      RETURNING id
    `, [hashAdmin]);

    const hashAgent = await bcrypt.hash('agent123', 10);
    const { rows: [agent] } = await client.query(`
      INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, direction)
      VALUES ('OUÉDRAOGO', 'Fatimata',
        'f.ouedraogo@univ-burkina.bf', $1, 'agent', 'Direction des Études')
      ON CONFLICT (email) DO UPDATE SET mot_de_passe = $1
      RETURNING id
    `, [hashAgent]);

    const hashVal = await bcrypt.hash('valid123', 10);
    const { rows: [validateur] } = await client.query(`
      INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, direction)
      VALUES ('SAWADOGO', 'Moussa',
        'm.sawadogo@univ-burkina.bf', $1, 'validateur', 'Direction Administrative')
      ON CONFLICT (email) DO UPDATE SET mot_de_passe = $1
      RETURNING id
    `, [hashVal]);

    // ── Dossier 1 ─────────────────────────────────────
    const { rows: [d1] } = await client.query(`
      INSERT INTO dossiers
        (reference, objet, instance, date_limite,
         statut, niveau_mise_en_oeuvre,
         cree_par, cree_par_email, description)
      VALUES
        ('UB-2025-001',
         'Révision du programme pédagogique L3 Sciences',
         'Conseil Académique',
         '2025-09-30',
         'En cours', 45,
         $1, 'admin@univ-burkina.bf',
         'Mise à jour des unités d''enseignement pour conformité LMD.')
      ON CONFLICT (reference) DO NOTHING
      RETURNING id
    `, [admin.id]);

    if (d1) {
      await client.query(`
        INSERT INTO intervenants (dossier_id, nom, role, direction, email, avancement)
        VALUES
          ($1, 'OUÉDRAOGO Fatimata', 'Responsable pédagogique',
           'Direction des Études', 'f.ouedraogo@univ-burkina.bf', 60),
          ($1, 'KABORÉ Issouf', 'Chef de département',
           'Département Sciences', 'i.kabore@univ-burkina.bf', 30)
      `, [d1.id]);

      await client.query(`
        INSERT INTO taches (dossier_id, titre, responsable, statut, date_echeance)
        VALUES
          ($1, 'Audit des UE existantes', 'OUÉDRAOGO F.', 'Terminée', '2025-03-31'),
          ($1, 'Rédaction nouveaux syllabi', 'KABORÉ I.', 'En cours', '2025-07-31'),
          ($1, 'Validation Conseil Académique', 'SAWADOGO M.', 'À faire', '2025-09-15')
      `, [d1.id]);
    }

    // ── Dossier 2 ─────────────────────────────────────
    const { rows: [d2] } = await client.query(`
      INSERT INTO dossiers
        (reference, objet, instance, date_limite,
         date_fin_effective, statut, niveau_mise_en_oeuvre,
         cree_par, cree_par_email, description)
      VALUES
        ('UB-2025-002',
         'Réhabilitation du campus de Bobo-Dioulasso',
         'Conseil d''Administration',
         '2025-03-31', '2025-03-28',
         'Bouclé', 100,
         $1, 'f.ouedraogo@univ-burkina.bf',
         'Travaux de rénovation des bâtiments pédagogiques et résidences.')
      ON CONFLICT (reference) DO NOTHING
      RETURNING id
    `, [agent.id]);

    if (d2) {
      await client.query(`
        INSERT INTO intervenants (dossier_id, nom, role, direction, avancement)
        VALUES
          ($1, 'TRAORÉ Aminata', 'Maître d''ouvrage',
           'Direction des Infrastructures', 100)
      `, [d2.id]);
    }

    // ── Dossier 3 ─────────────────────────────────────
    const { rows: [d3] } = await client.query(`
      INSERT INTO dossiers
        (reference, objet, instance, date_limite,
         statut, niveau_mise_en_oeuvre,
         cree_par, cree_par_email, description)
      VALUES
        ('UB-2025-003',
         'Plan de recrutement du personnel enseignant 2025-2026',
         'Conseil d''Administration',
         '2025-06-15',
         'En retard', 20,
         $1, 'admin@univ-burkina.bf',
         'Recrutement de 45 enseignants pour couvrir les besoins des filières.')
      ON CONFLICT (reference) DO NOTHING
      RETURNING id
    `, [admin.id]);

    if (d3) {
      await client.query(`
        INSERT INTO alertes (dossier_id, type, message, priorite)
        VALUES
          ($1, 'delai_depasse',
           'Le dossier "Plan de recrutement" accuse un retard de 3 semaines.',
           'Critique'),
          ($1, 'action_requise',
           'Relance du Ministère de tutelle nécessaire.',
           'Critique')
      `, [d3.id]);
    }

    // ── Dossier 4 ─────────────────────────────────────
    await client.query(`
      INSERT INTO dossiers
        (reference, objet, instance, date_limite,
         statut, niveau_mise_en_oeuvre,
         cree_par, cree_par_email)
      VALUES
        ('UB-2025-004',
         'Mise en place du système de gestion des notes en ligne',
         'Comité Informatique',
         '2025-12-31',
         'Initié', 0,
         $1, 'admin@univ-burkina.bf')
      ON CONFLICT (reference) DO NOTHING
    `, [admin.id]);

    await client.query('COMMIT');
    console.log('✅ Seed réussi');
    console.log('');
    console.log('Comptes disponibles :');
    console.log('  admin@univ-burkina.bf        / admin123  (admin)');
    console.log('  f.ouedraogo@univ-burkina.bf  / agent123  (agent)');
    console.log('  m.sawadogo@univ-burkina.bf   / valid123  (validateur)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur seed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
