const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'instances_direction',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let dejaLoggue = false;
pool.on('connect', () => {
  if (!dejaLoggue) {
    console.log('✅ PostgreSQL connecté');
    dejaLoggue = true;
  }
});

pool.on('error', (err) => console.error('❌ Erreur PG:', err.message));

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
