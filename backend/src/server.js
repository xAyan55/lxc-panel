import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { generalLimiter } from './middleware/rateLimit.js';
import { setupConsoleWebSocket } from './routes/console.js';
import lxdService from './services/lxd.js';
import backupScheduler from './services/backup.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import containerRoutes from './routes/containers.js';
import backupRoutes from './routes/backups.js';
import statsRoutes from './routes/stats.js';
import tmateRoutes from './routes/tmate.js';
import apikeyRoutes from './routes/apikeys.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(generalLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', lxd_ready: lxdService.ready, timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tmate', tmateRoutes);
app.use('/api/apikeys', apikeyRoutes);

// Serve Static Frontend (Production)
const distPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
  console.log('[Server] Serving Frontend from:', distPath);
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const server = http.createServer(app);

// Setup WebSocket
setupConsoleWebSocket(server);

async function start() {
  // Initialize database
  getDb();
  console.log('[DB] Database initialized');

  // Initialize LXD
  await lxdService.init();

  // Initialize backup scheduler
  backupScheduler.init();

  server.listen(PORT, () => {
    console.log(`[Server] VM Panel API running on port ${PORT}`);
    console.log(`[Server] WebSocket ready for console connections`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  backupScheduler.stopAll();
  closeDb();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  backupScheduler.stopAll();
  closeDb();
  server.close(() => process.exit(0));
});

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
