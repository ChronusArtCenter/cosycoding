const express = require('express');
const WebSocket = require('ws');
const { pool, initDB } = require('./db');

const app = express();
app.use(express.json()); // Parse JSON bodies

const server = app.listen(3000, async () => {
  await initDB(); // Initialize DB on startup
  console.log("Server running on http://localhost:3000");
});

const wss = new WebSocket.Server({ server });

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
    // Broadcast changes to all clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});