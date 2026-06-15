require('dotenv').config();
const { pool } = require('./database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Table utilisateurs ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS utilisateurs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nom          VARCHAR(100) NOT NULL,
        prenom       VARCHAR(100) NOT NULL,
        email        VARCHAR(255) UNIQUE NOT NULL,
        mot_de_passe VARCHAR(255) NOT NULL,
        role         VARCHAR(50)  DEFAULT 'agent',
        direction    VARCHAR(150),
        actif        BOOLEAN      DEFAULT true,
        created_at   TIMESTAMP    DEFAULT NOW()
      );
    `);

    // ── Table dossiers ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS dossiers (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference             VARCHAR(60)  UNIQUE NOT NULL,
        objet                 VARCHAR(300) NOT NULL,
        instance              VARCHAR(150) NOT NULL,
        date_limite           DATE         NOT NULL,
        date_fin_effective    DATE,
        statut                VARCHAR(50)  DEFAULT 'Initié',
        niveau_mise_en_oeuvre INTEGER      DEFAULT 0
          CHECK (niveau_mise_en_oeuvre BETWEEN 0 AND 100),
        description           TEXT         DEFAULT '',
        cree_par              UUID         REFERENCES utilisateurs(id),
        cree_par_email        VARCHAR(255),
        valide_par            UUID         REFERENCES utilisateurs(id),
        valide_par_nom        VARCHAR(200),
        date_validation       TIMESTAMP,
        fichiers              JSONB        DEFAULT '[]',
        created_at            TIMESTAMP    DEFAULT NOW(),
        updated_at            TIMESTAMP    DEFAULT NOW()
      );
    `);

    // ── Ajouter colonnes manquantes si table existe déjà ──
    const colonnesAAjouter = [
      `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS
         valide_par UUID REFERENCES utilisateurs(id)`,
      `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS
         valide_par_nom VARCHAR(200)`,
      `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS
         date_validation TIMESTAMP`,
      `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS
         fichiers JSONB DEFAULT '[]'`,
      `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS
         cree_par_email VARCHAR(255)`,
      `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS
         description TEXT DEFAULT ''`,
      `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS
         updated_at TIMESTAMP DEFAULT NOW()`,
    ];

    for (const sql of colonnesAAjouter) {
      await client.query(sql);
    }

    // ── Table intervenants ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS intervenants (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dossier_id  UUID REFERENCES dossiers(id) ON DELETE CASCADE,
        nom         VARCHAR(150) NOT NULL,
        role        VARCHAR(100) NOT NULL,
        direction   VARCHAR(150),
        email       VARCHAR(255),
        avancement  INTEGER DEFAULT 0
          CHECK (avancement BETWEEN 0 AND 100),
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // ── Table taches ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS taches (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dossier_id    UUID REFERENCES dossiers(id) ON DELETE CASCADE,
        titre         VARCHAR(255) NOT NULL,
        responsable   VARCHAR(150),
        statut        VARCHAR(50)  DEFAULT 'À faire',
        date_echeance DATE,
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    // ── Table alertes ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS alertes (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dossier_id    UUID REFERENCES dossiers(id) ON DELETE CASCADE,
        reference     VARCHAR(60),
        objet         VARCHAR(300),
        type          VARCHAR(100) NOT NULL,
        message       TEXT         NOT NULL,
        priorite      VARCHAR(50)  DEFAULT 'Info',
        responsable   VARCHAR(150),
        est_lue       BOOLEAN      DEFAULT false,
        email_envoye  BOOLEAN      DEFAULT false,
        created_at    TIMESTAMP    DEFAULT NOW()
      );
    `);

    // ── Index ─────────────────────────────────────────────
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_dossiers_statut
       ON dossiers(statut);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_dossiers_cree_par
       ON dossiers(cree_par);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_alertes_lue
       ON alertes(est_lue);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_intervenants_dos
       ON intervenants(dossier_id);`
    );

    await client.query('COMMIT');
    console.log('✅ Migration réussie — tables et colonnes à jour');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur migration:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
