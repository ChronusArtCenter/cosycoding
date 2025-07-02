require('dotenv').config(); 

const { Pool } = require('pg');

// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: 5432,
// });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
// const pool = new Pool({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'glitch',
//   password: 'qqqq', 
//   port: 5432,
// });

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Initialize database tables
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(10) PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);
    console.log("Database tables initialized");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

// Save or update project
async function upsertProject({id, code, expiresAt}) {
  try {
    const result = await pool.query(
      `INSERT INTO projects (id, code, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) 
       DO UPDATE SET code = $2, expires_at = $3
       RETURNING id`,
      [id, code, expiresAt]
    );
    return result.rows[0].id;
  } catch (err) {
    console.error("Database operation failed:", err);
    throw err;
  }
}

// Get project by ID
async function getProjectById(id) {
  try {
    const result = await pool.query(
      'SELECT code FROM projects WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (err) {
    console.error("Database query failed:", err);
    throw err;
  }
}

module.exports = {
  pool,
  initDB,
  upsertProject,
  getProjectById
};