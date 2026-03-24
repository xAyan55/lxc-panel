import { WebSocketServer } from 'ws';
import url from 'url';
import { authenticateWs } from '../middleware/auth.js';
import { getDb } from '../config/database.js';
import lxdService from '../services/lxd.js';

export function setupConsoleWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url, true).pathname;

    if (pathname === '/ws/console') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname === '/ws/stats') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('stats-connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, request) => {
    const params = url.parse(request.url, true).query;
    const { token, container_id } = params;

    const user = authenticateWs(token);
    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
      ws.close();
      return;
    }

    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(container_id);
    if (!container) {
      ws.send(JSON.stringify({ type: 'error', message: 'Container not found' }));
      ws.close();
      return;
    }

    if (user.role !== 'admin' && container.user_id !== user.id) {
      ws.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
      ws.close();
      return;
    }

    if (container.status !== 'running') {
      ws.send(JSON.stringify({ type: 'error', message: 'Container is not running' }));
      ws.close();
      return;
    }

    let proc;
    try {
      proc = lxdService.spawnConsole(container.lxd_name);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: `Failed to open console: ${err.message}` }));
      ws.close();
      return;
    }

    ws.send(JSON.stringify({ type: 'connected', container: container.display_name }));

    proc.stdout.on('data', (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: data.toString('utf8') }));
      }
    });

    proc.stderr.on('data', (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: data.toString('utf8') }));
      }
    });

    proc.on('close', (code) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code }));
        ws.close();
      }
    });

    proc.on('error', (err) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close();
      }
    });

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'input' && proc.stdin.writable) {
          proc.stdin.write(msg.data);
        } else if (msg.type === 'resize' && msg.cols && msg.rows) {
          // Terminal resize not directly supported via CLI spawn
        }
      } catch {}
    });

    ws.on('close', () => {
      try { proc.kill(); } catch {}
    });
  });

  // Stats WebSocket for real-time metrics
  wss.on('stats-connection', async (ws, request) => {
    const params = url.parse(request.url, true).query;
    const { token, container_id } = params;

    const user = authenticateWs(token);
    if (!user) {
      ws.close();
      return;
    }

    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(container_id);
    if (!container || (user.role !== 'admin' && container.user_id !== user.id)) {
      ws.close();
      return;
    }

    const sendMetrics = async () => {
      if (ws.readyState !== ws.OPEN) return;
      try {
        const metrics = await lxdService.getContainerMetrics(container.lxd_name);
        ws.send(JSON.stringify({ type: 'metrics', data: metrics }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    };

    await sendMetrics();
    const interval = setInterval(sendMetrics, 5000);

    ws.on('close', () => clearInterval(interval));
    ws.on('error', () => clearInterval(interval));
  });

  return wss;
}
