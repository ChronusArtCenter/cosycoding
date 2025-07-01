const { Pool } = require('pg');
const pool = new Pool({ /* same as server.js */ });

async function cleanup() {
  await pool.query(
    'DELETE FROM projects WHERE expires_at < NOW()'
  );
  console.log('Cleaned up old projects');
}

cleanup().then(() => process.exit(0));