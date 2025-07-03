require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Initialize database tables with assets support
async function initDB() {
  try {
    console.log("Creating projects table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(10) PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);
    console.log("Projects table created/exists");

    console.log("Creating assets table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(10) NOT NULL,
        url TEXT NOT NULL,
        filename TEXT NOT NULL,
        type VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_project
          FOREIGN KEY(project_id) 
          REFERENCES projects(id)
          ON DELETE CASCADE,
        UNIQUE(project_id, url)
         );
    `);
    console.log("Assets table created/exists");

    console.log("Creating index...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_project_id 
      ON assets(project_id)
    `);
    console.log("Database tables initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

// Project functions
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

// Asset functions
async function addProjectAsset(projectId, asset) {
  try {
    console.log("Adding asset:", { projectId, asset }); // Debug log
    const result = await pool.query(
      `INSERT INTO assets (project_id, url, filename, type, size)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, asset.url, asset.filename, asset.type, asset.size]
    );
    console.log("Asset added:", result.rows[0]); // Debug log
    return result.rows[0];
  } catch (err) {
    console.error("Failed to add asset:", err);
    throw err;
  }
}

async function getProjectAssets(projectId) {
  try {
    const result = await pool.query(
      'SELECT url, filename, type, size, uploaded_at FROM assets WHERE project_id = $1 ORDER BY uploaded_at DESC',
      [projectId]
    );
    return result.rows;
  } catch (err) {
    console.error("Failed to get assets:", err);
    throw err;
  }
}

async function removeProjectAsset(projectId, assetUrl) {
  try {
    await pool.query(
      'DELETE FROM assets WHERE project_id = $1 AND url = $2',
      [projectId, assetUrl]
    );
    console.log(`Asset deleted: ${assetUrl}`);
  } catch (err) {
    console.error('Failed to delete asset:', err);
    throw err;
  }
}

module.exports = {
  pool,
  initDB,
  upsertProject,
  getProjectById,
  addProjectAsset,
  getProjectAssets,
  removeProjectAsset
};