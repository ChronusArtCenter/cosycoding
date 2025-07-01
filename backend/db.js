const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

// Create projects table (run this once on startup)
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(10) PRIMARY KEY,
      code TEXT,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
  console.log("Database initialized");
}

module.exports = { pool, initDB };