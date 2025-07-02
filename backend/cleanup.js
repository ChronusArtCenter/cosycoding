const { pool } = require('./db');

async function cleanup() {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE expires_at < NOW() RETURNING id'
    );
    console.log(`Cleaned up ${result.rowCount} expired projects`);
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    process.exit(0);
  }
}

cleanup();