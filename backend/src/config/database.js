// chemin d'origine supposé : backend/src/config/database.js
const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

let pool;

// 1. Connexion via une chaîne unique (DATABASE_URL) - Recommandé pour Render / Supabase / Neon
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });
} 
// 2. Connexion via des variables d'environnement séparées (Optionnel / Local)
else {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'instances_direction',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });
}

// Tester la connexion et afficher un message clair au démarrage
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur de connexion à PostgreSQL :', err.message);
  } else {
    console.log('✅ Connexion à PostgreSQL établie avec succès !');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
