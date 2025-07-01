const express = require('express');
const { Pool } = require('pg');
const WebSocket = require('ws');
const redis = require('redis');

const app = express();
const server = app.listen(3000);
const wss = new WebSocket.Server({ server });

// PostgreSQL setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

// Redis for WebSocket sessions
const redisClient = redis.createClient(process.env.REDIS_URL);

// Create a new project
app.post('/project', async (req, res) => {
  const { code } = req.body;
  const projectId = Math.random().toString(36).substring(2, 8);
  const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days
  
  await pool.query(
    'INSERT INTO projects (id, code, expires_at) VALUES ($1, $2, $3)',
    [projectId, code, expiresAt]
  );
  
  res.json({ id: projectId });
});

// WebSocket for real-time editing
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Broadcast changes to all clients in the same project
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});