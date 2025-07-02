// Error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Require dependencies
const WebSocket = require('ws');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { initDB, upsertProject, getProjectById } = require('./db');

// Initialize express app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Configure allowed file types
const allowedMimeTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/zip': 'zip'
};

// File upload configuration
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${Object.keys(allowedMimeTypes).join(', ')}`), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = allowedMimeTypes[file.mimetype] || path.extname(file.originalname).substring(1);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Rate limiting
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 uploads per IP
});

// Routes
app.post('/project', async (req, res) => {
  try {
    const { code, id } = req.body;
    const projectId = id || generateProjectId();
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    
    await upsertProject({ id: projectId, code, expiresAt });
    res.json({ id: projectId });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

app.get('/api/project/:id', async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    res.json(project || {});
  } catch (err) {
    console.error('Load error:', err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

app.post('/upload', uploadLimiter, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type' });
  }
  res.json({
    url: `/uploads/${req.file.filename}`,
    type: req.file.mimetype,
    size: req.file.size
  });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Helper functions
function generateProjectId() {
  return Math.random().toString(36).substring(2, 8);
}

// Server initialization
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${server.address().port}`);
});


// WebSocket Server
const wss = new WebSocket.Server({ server });

// Track connected clients and their projects
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle different message types
      switch (data.type) {
        case 'join':
          handleJoin(ws, data.projectId);
          break;
        case 'edit':
          handleEdit(data.projectId, data.changes, ws);
          break;
        case 'cursor':
          // Optional: Handle cursor position updates
          broadcastCursor(data.projectId, data.cursorPos, data.clientId, ws);
          break;
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});


// Handle new client joining a project
function handleJoin(ws, projectId) {
  if (!clients.has(projectId)) {
    clients.set(projectId, []);
  }
  
  const clientId = generateClientId();
  clients.get(projectId).push({
    ws,
    clientId
  });
  
  // Send welcome message with client ID
  ws.send(JSON.stringify({
    type: 'init',
    clientId
  }));
}

// Handle code edits and broadcast to others
function handleEdit(projectId, changes, senderWs) {
  const projectClients = clients.get(projectId) || [];
  
  // Validate changes structure
  if (!changes || !changes.from || !changes.to) {
    console.error('Invalid changes object:', changes);
    return;
  }

  projectClients.forEach(client => {
    // Don't send back to the original sender
    if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify({
          type: 'update',
          changes: {
            from: changes.from,
            to: changes.to,
            text: changes.text,
            origin: changes.origin || 'remote'
          }
        }));
      } catch (err) {
        console.error('Error sending update:', err);
      }
    }
  });
}
// Optional: Handle cursor position broadcasting
function broadcastCursor(projectId, cursorPos, clientId, senderWs) {
  const projectClients = clients.get(projectId) || [];
  
  projectClients.forEach(client => {
    if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'cursor',
        clientId,
        cursorPos
      }));
    }
  });
}

// Handle client disconnection
function handleDisconnect(ws) {
  for (const [projectId, projectClients] of clients.entries()) {
    clients.set(
      projectId, 
      projectClients.filter(client => client.ws !== ws)
    );
    
    // Notify others about disconnection (optional)
    const remainingClients = clients.get(projectId);
    remainingClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'user-left',
          clientId: ws.clientId
        }));
      }
    });
  }
}

function generateClientId() {
  return Math.random().toString(36).substr(2, 9);
}